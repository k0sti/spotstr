import { useState, useEffect } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  VStack,
  HStack,
  Input,
  Select,
  Button,
  Text,
  FormControl,
  FormLabel,
  useToast,
  Box,
  Tooltip,
  IconButton
} from '@chakra-ui/react'
import { useAccounts } from 'applesauce-react/hooks'
import { useNostr } from '../hooks/useNostr'
import { useGroups } from '../hooks/useGroups'
import { useContacts } from '../hooks/useContacts'
import { generateGeohash, npubToHex } from '../utils/crypto'
import { getGeolocationImplementation } from '../utils/locationSimulator'
import { createLocationEvent, signAndPublishLocationEvent } from '../utils/locationEvents'
import { continuousSharingService } from '../services/continuousSharingService'

interface ShareLocationPopupProps {
  isOpen: boolean
  onClose: () => void
  initialGeohash?: string
  onStatusChange?: (status: { type: 'sending' | 'sent' | 'error' | 'waiting', count?: number, message?: string }) => void
}

export function ShareLocationPopup({
  isOpen,
  onClose,
  initialGeohash = '',
  onStatusChange
}: ShareLocationPopupProps) {
  const toast = useToast()
  const accounts = useAccounts()
  const { publishLocationEvent, connectedRelays } = useNostr()
  const { groups } = useGroups()
  const { contacts } = useContacts()

  const [geohash, setGeohash] = useState(initialGeohash)
  const [selectedSender, setSelectedSender] = useState('')
  const [selectedReceiver, setSelectedReceiver] = useState('')
  const [continuousSharingState, setContinuousSharingState] = useState(continuousSharingService.getCurrentState())

  // Set initial geohash when prop changes
  useEffect(() => {
    if (initialGeohash) {
      setGeohash(initialGeohash)
    }
  }, [initialGeohash])

  // Set first identity as default sender
  useEffect(() => {
    if (accounts.length > 0 && !selectedSender) {
      setSelectedSender(accounts[0].pubkey)
    }
  }, [accounts, selectedSender])

  // Set first group or contact as default receiver
  useEffect(() => {
    if (!selectedReceiver) {
      if (groups.length > 0) {
        setSelectedReceiver(`group:${groups[0].id}`)
      } else if (contacts.length > 0) {
        setSelectedReceiver(`contact:${contacts[0].id}`)
      }
    }
  }, [groups, contacts, selectedReceiver])

  // Subscribe to continuous sharing state
  useEffect(() => {
    const subscription = continuousSharingService.getState().subscribe(state => {
      setContinuousSharingState(state)

      // Update status when sharing
      if (state.isSharing && state.eventCount > 0) {
        onStatusChange?.({ type: 'sent', count: state.eventCount })
      }
    })

    return () => subscription.unsubscribe()
  }, [onStatusChange])

  const publishLocationWithGeohash = async (geohash: string): Promise<void> => {
    if (!selectedSender || !selectedReceiver) {
      throw new Error('Missing sender or receiver')
    }

    if (connectedRelays.length === 0) {
      throw new Error('No relays connected')
    }

    // Get sender account
    const senderAccount = accounts.find(acc => acc.pubkey === selectedSender)
    if (!senderAccount) {
      throw new Error('Sender account not found')
    }

    // Get receiver's public key
    let receiverPublicKey: string
    if (selectedReceiver.startsWith('group:')) {
      const groupId = selectedReceiver.slice(6)
      const group = groups.find(g => g.id === groupId)
      if (!group) {
        throw new Error('Group not found')
      }
      receiverPublicKey = npubToHex(group.npub)
    } else if (selectedReceiver.startsWith('contact:')) {
      const contactId = selectedReceiver.slice(8)
      const contact = contacts.find(c => c.id === contactId)
      if (!contact) {
        throw new Error('Contact not found')
      }
      receiverPublicKey = contact.pubkey
    } else {
      throw new Error('Invalid receiver')
    }

    // Create location event with 1 minute expiry for real-time sharing
    const { unsignedEvent } = await createLocationEvent({
      senderAccount,
      receiverPublicKey,
      geohash,
      locationName: 'real-time', // Always use 'real-time' for d-tag
      expirySeconds: 60, // 1 minute expiry
      isPublic: false
    })

    // Sign and publish
    onStatusChange?.({ type: 'sending' })

    const result = await signAndPublishLocationEvent(
      unsignedEvent,
      senderAccount.signer,
      connectedRelays,
      publishLocationEvent
    )

    if (!result.success) {
      throw new Error(result.error || 'Failed to publish')
    }
  }

  const queryDeviceLocation = async () => {
    const geolocation = getGeolocationImplementation()

    if (!geolocation) {
      toast({
        title: 'Location not supported',
        description: 'Your browser does not support geolocation',
        status: 'error',
        duration: 3000,
      })
      return
    }

    geolocation.getCurrentPosition(
      (position) => {
        const hash = generateGeohash(position.coords.latitude, position.coords.longitude, 8)
        setGeohash(hash)

        toast({
          title: 'Location obtained',
          status: 'success',
          duration: 2000,
        })
      },
      (error) => {
        onStatusChange?.({ type: 'error', message: error.message })
        toast({
          title: 'Location error',
          description: error.message,
          status: 'error',
          duration: 3000,
        })
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }


  const handleStartSharing = () => {
    if (!selectedSender || !selectedReceiver) {
      toast({
        title: 'Missing information',
        description: 'Please select both sender and receiver',
        status: 'warning',
        duration: 3000,
      })
      return
    }

    if (connectedRelays.length === 0) {
      toast({
        title: 'No relays connected',
        description: 'Please connect to at least one relay in Settings',
        status: 'warning',
        duration: 3000,
      })
      return
    }

    // Start continuous sharing
    const success = continuousSharingService.startContinuousSharing(
      selectedSender,
      selectedReceiver,
      publishLocationWithGeohash,
      () => {
        onStatusChange?.({ type: 'sent', count: continuousSharingService.getCurrentState().eventCount })
      }
    )

    if (success) {
      toast({
        title: 'Continuous sharing started',
        description: 'Location will be sent when geohash changes',
        status: 'info',
        duration: 3000,
      })

      // Close the modal but keep sharing
      onClose()
    } else {
      toast({
        title: 'Failed to start sharing',
        description: 'Geolocation is not supported',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleClose = () => {
    // Just close modal, don't stop sharing
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Share Location (Real-time)</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel fontSize="sm">Location</FormLabel>
              <HStack>
                <Input
                  placeholder="Geohash"
                  value={geohash}
                  onChange={(e) => setGeohash(e.target.value)}
                  fontFamily="mono"
                  size="sm"
                />
                <Tooltip label="Query device location">
                  <IconButton
                    aria-label="Query Location"
                    icon={<span>📍</span>}
                    size="sm"
                    onClick={queryDeviceLocation}
                    variant="outline"
                  />
                </Tooltip>
              </HStack>
            </FormControl>

            <Box p={2} bg="blue.50" borderRadius="md">
              <Text fontSize="sm" color="blue.800">
                Continuous location sharing with 1-minute expiry. Updates every 30 seconds.
              </Text>
            </Box>

            <FormControl>
              <FormLabel fontSize="sm">From</FormLabel>
              <Select
                value={selectedSender}
                onChange={(e) => setSelectedSender(e.target.value)}
                size="sm"
              >
                {accounts.length === 0 ? (
                  <option value="">No identities available</option>
                ) : (
                  accounts.map((account) => (
                    <option key={account.pubkey} value={account.pubkey}>
                      {account.metadata?.name || 'Unnamed'} ({account.pubkey.slice(0, 8)}...)
                    </option>
                  ))
                )}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">To</FormLabel>
              <Select
                value={selectedReceiver}
                onChange={(e) => setSelectedReceiver(e.target.value)}
                size="sm"
              >
                {groups.length === 0 && contacts.length === 0 ? (
                  <option value="">No recipients available</option>
                ) : (
                  <>
                    {groups.length > 0 && (
                      <optgroup label="Groups">
                        {groups.map((group) => (
                          <option key={group.id} value={`group:${group.id}`}>
                            {group.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {contacts.length > 0 && (
                      <optgroup label="Contacts">
                        {contacts.map((contact) => (
                          <option key={contact.id} value={`contact:${contact.id}`}>
                            {contact.customName || contact.metadata?.name || contact.npub.slice(0, 16) + '...'}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </>
                )}
              </Select>
            </FormControl>

            {accounts.length === 0 && (
              <Box p={2} bg="orange.50" borderRadius="md">
                <Text fontSize="sm" color="orange.800">
                  Please add an identity first to share locations
                </Text>
              </Box>
            )}

            {groups.length === 0 && contacts.length === 0 && (
              <Box p={2} bg="orange.50" borderRadius="md">
                <Text fontSize="sm" color="orange.800">
                  Please create a group or add a contact first to share locations
                </Text>
              </Box>
            )}

            {connectedRelays.length === 0 && (
              <Box p={2} bg="orange.50" borderRadius="md">
                <Text fontSize="sm" color="orange.800">
                  Please connect to at least one relay in Settings
                </Text>
              </Box>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button
            colorScheme="blue"
            mr={3}
            onClick={handleStartSharing}
            isDisabled={
              !selectedSender ||
              !selectedReceiver ||
              accounts.length === 0 ||
              (groups.length === 0 && contacts.length === 0) ||
              connectedRelays.length === 0 ||
              continuousSharingState.isSharing
            }
          >
            {continuousSharingState.isSharing ? 'Sharing Active' : 'Start Sharing'}
          </Button>
          <Button variant="ghost" onClick={handleClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}