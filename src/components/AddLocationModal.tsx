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
  IconButton,
  Divider
} from '@chakra-ui/react'
import { useAccounts } from 'applesauce-react/hooks'
import { useNostr } from '../hooks/useNostr'
import { useGroups } from '../hooks/useGroups'
import { useContacts } from '../hooks/useContacts'
import { generateGeohash, npubToHex } from '../utils/crypto'
import { LocationService } from '../services/locationService'
import { createLocationEvent, signAndPublishLocationEvent, parseExpiryTime } from '../utils/locationEvents'

interface AddLocationModalProps {
  isOpen: boolean
  onClose: () => void
  initialGeohash?: string
}

export function AddLocationModal({ isOpen, onClose, initialGeohash = '' }: AddLocationModalProps) {
  const toast = useToast()
  const accounts = useAccounts()
  const { publishLocationEvent, connectedRelays } = useNostr()
  const { groups } = useGroups()
  const { contacts } = useContacts()

  const [geohash, setGeohash] = useState(initialGeohash)
  const [locationName, setLocationName] = useState('')
  const [accuracy, setAccuracy] = useState<string>('')
  const [expiryTime, setExpiryTime] = useState('1h')
  const [selectedSender, setSelectedSender] = useState('')
  const [selectedReceiver, setSelectedReceiver] = useState('public')
  const [isPublishing, setIsPublishing] = useState(false)
  const [additionalTags, setAdditionalTags] = useState<Array<{ key: string; value: string }>>([])

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

  const queryDeviceLocation = async () => {
    console.log('[AddLocationModal] Querying device location...')

    const position = await LocationService.getCurrentPosition()

    if (position) {
      const hash = generateGeohash(position.coords.latitude, position.coords.longitude, 8)
      setGeohash(hash)

      // Update accuracy if available
      if (position.coords.accuracy) {
        setAccuracy(Math.round(position.coords.accuracy).toString())
      }

      toast({
        title: 'Location obtained',
        status: 'success',
        duration: 2000,
      })
    } else {
      toast({
        title: 'Location error',
        description: 'Failed to get location. Please check permissions.',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleAddTag = () => {
    setAdditionalTags([...additionalTags, { key: '', value: '' }])
  }

  const handleUpdateTag = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...additionalTags]
    updated[index][field] = value
    setAdditionalTags(updated)
  }

  const handleRemoveTag = (index: number) => {
    setAdditionalTags(additionalTags.filter((_, i) => i !== index))
  }

  const handleAddLocation = async () => {
    if (!geohash) {
      toast({
        title: 'Geohash required',
        description: 'Please enter a geohash or query device location',
        status: 'warning',
        duration: 3000,
      })
      return
    }

    if (!selectedSender) {
      toast({
        title: 'Missing information',
        description: 'Please select a sender',
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

    try {
      setIsPublishing(true)

      // Get sender account
      const senderAccount = accounts.find(acc => acc.pubkey === selectedSender)
      if (!senderAccount) {
        throw new Error('Sender account not found')
      }

      // Parse expiry time
      let expirySeconds = 3600 // default 1 hour
      try {
        if (expiryTime) {
          expirySeconds = parseExpiryTime(expiryTime)
        }
      } catch (error) {
        toast({
          title: 'Invalid expiry time',
          description: 'Use format like: 5min, 1h, 2d',
          status: 'error',
          duration: 3000,
        })
        return
      }

      // Determine if public or private
      const isPublic = selectedReceiver === 'public'
      let receiverPublicKey: string | null = null

      if (!isPublic) {
        if (selectedReceiver.startsWith('group:')) {
          const groupId = selectedReceiver.slice(6)
          const group = groups.find(g => g.id === groupId)
          if (!group) {
            throw new Error('Selected group not found')
          }
          receiverPublicKey = npubToHex(group.npub)
        } else if (selectedReceiver.startsWith('contact:')) {
          const contactId = selectedReceiver.slice(8)
          const contact = contacts.find(c => c.id === contactId)
          if (!contact) {
            throw new Error('Selected contact not found')
          }
          receiverPublicKey = contact.pubkey
        } else {
          throw new Error('Invalid receiver')
        }
      }

      // Prepare additional tags
      const extraTags = additionalTags
        .filter(tag => tag.key && tag.value)
        .map(tag => [tag.key, tag.value])

      // Create location event
      const { unsignedEvent } = await createLocationEvent({
        senderAccount,
        receiverPublicKey,
        geohash,
        locationName: locationName || undefined,
        accuracy: accuracy ? parseInt(accuracy) : undefined,
        expirySeconds,
        additionalTags: extraTags,
        isPublic
      })

      // Sign and publish
      const result = await signAndPublishLocationEvent(
        unsignedEvent,
        senderAccount.signer,
        connectedRelays,
        publishLocationEvent
      )

      if (result.success) {
        toast({
          title: 'Location added',
          description: `Location event has been published to ${connectedRelays.length} relay(s)`,
          status: 'success',
          duration: 3000,
        })

        // Reset form
        setGeohash('')
        setLocationName('')
        setAccuracy('')
        setExpiryTime('1h')
        setSelectedReceiver('public')
        setAdditionalTags([])
        onClose()
      } else {
        throw new Error(result.error || 'Failed to publish')
      }
    } catch (error) {
      console.error('Failed to add location:', error)
      toast({
        title: 'Failed to add location',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        status: 'error',
        duration: 5000,
      })
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add Location</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel fontSize="sm">Location Name (optional)</FormLabel>
              <Input
                placeholder="e.g., home, office"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                size="sm"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Leave empty for single location, or name it for multiple locations
              </Text>
            </FormControl>

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

            <FormControl>
              <FormLabel fontSize="sm">Accuracy (meters, optional)</FormLabel>
              <Input
                type="number"
                placeholder="Leave empty if not known"
                value={accuracy}
                onChange={(e) => setAccuracy(e.target.value)}
                size="sm"
              />
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">Expires</FormLabel>
              <Input
                placeholder="e.g., 5min, 1h, 2d"
                value={expiryTime}
                onChange={(e) => setExpiryTime(e.target.value)}
                size="sm"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Format: number + unit (s/min/h/d/w)
              </Text>
            </FormControl>

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
                <option value="public">Public (kind:30472)</option>
                {groups.length > 0 && (
                  <optgroup label="Groups">
                    {groups.map((group) => (
                      <option key={group.id} value={`group:${group.id}`}>
                        {group.name} (private)
                      </option>
                    ))}
                  </optgroup>
                )}
                {contacts.length > 0 && (
                  <optgroup label="Contacts">
                    {contacts.map((contact) => (
                      <option key={contact.id} value={`contact:${contact.id}`}>
                        {contact.customName || contact.metadata?.name || contact.npub.slice(0, 16) + '...'} (private)
                      </option>
                    ))}
                  </optgroup>
                )}
              </Select>
            </FormControl>

            <Divider />

            <FormControl>
              <HStack justify="space-between" mb={2}>
                <FormLabel fontSize="sm" mb={0}>Additional Tags</FormLabel>
                <Button size="xs" onClick={handleAddTag}>
                  Add Tag +
                </Button>
              </HStack>
              <VStack spacing={2} align="stretch">
                {additionalTags.map((tag, index) => (
                  <HStack key={index}>
                    <Input
                      placeholder="Key"
                      value={tag.key}
                      onChange={(e) => handleUpdateTag(index, 'key', e.target.value)}
                      size="sm"
                    />
                    <Input
                      placeholder="Value"
                      value={tag.value}
                      onChange={(e) => handleUpdateTag(index, 'value', e.target.value)}
                      size="sm"
                    />
                    <IconButton
                      aria-label="Remove tag"
                      icon={<span>❌</span>}
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveTag(index)}
                    />
                  </HStack>
                ))}
                {additionalTags.length === 0 && (
                  <Text fontSize="xs" color="gray.500">
                    No additional tags. Click "Add Tag" to include custom tags.
                  </Text>
                )}
              </VStack>
            </FormControl>

            {accounts.length === 0 && (
              <Box p={2} bg="orange.50" borderRadius="md">
                <Text fontSize="sm" color="orange.800">
                  Please add an identity first to add locations
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
            onClick={handleAddLocation}
            isLoading={isPublishing}
            isDisabled={
              !geohash ||
              !selectedSender ||
              accounts.length === 0 ||
              connectedRelays.length === 0
            }
          >
            Add
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}