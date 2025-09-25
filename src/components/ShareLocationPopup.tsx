import { useState, useEffect, useRef } from 'react'
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
import { generateGeohash, npubToHex } from '../utils/crypto'
import { getGeolocationImplementation } from '../utils/locationSimulator'
import { createLocationEvent, signAndPublishLocationEvent } from '../utils/locationEvents'

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

  const [geohash, setGeohash] = useState(initialGeohash)
  const [selectedSender, setSelectedSender] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [eventCount, setEventCount] = useState(0)

  const watchIdRef = useRef<number | null>(null)
  const intervalIdRef = useRef<number | null>(null)
  const isPublishingRef = useRef(false)
  const isCancelledRef = useRef(false)

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

  // Set first group as default receiver
  useEffect(() => {
    if (groups.length > 0 && !selectedGroup) {
      setSelectedGroup(groups[0].id)
    }
  }, [groups, selectedGroup])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopContinuousLocationUpdates()
    }
  }, [])

  const startContinuousLocationUpdates = () => {
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

    // Start watching position
    watchIdRef.current = geolocation.watchPosition(
      (position) => {
        const hash = generateGeohash(position.coords.latitude, position.coords.longitude, 8)
        setGeohash(hash)
      },
      (error) => {
        console.error('[Location Error]', error)
        onStatusChange?.({ type: 'error', message: error.message })
        toast({
          title: 'Location Error',
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

    // Publish location immediately
    publishLocation()

    // Then publish every 30 seconds
    intervalIdRef.current = window.setInterval(() => {
      if (geohash && !isPublishingRef.current && !isCancelledRef.current) {
        publishLocation()
      }
    }, 30000)
  }

  const stopContinuousLocationUpdates = () => {
    isCancelledRef.current = true

    if (watchIdRef.current !== null) {
      const geolocation = getGeolocationImplementation()
      geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (intervalIdRef.current !== null) {
      window.clearInterval(intervalIdRef.current)
      intervalIdRef.current = null
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

  const publishLocation = async () => {
    if (isCancelledRef.current) return

    if (!geohash) {
      toast({
        title: 'Geohash required',
        description: 'Please enter a geohash or query device location',
        status: 'warning',
        duration: 3000,
      })
      return
    }

    if (!selectedSender || !selectedGroup) {
      toast({
        title: 'Missing information',
        description: 'Please select both sender and receiver group',
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
      isPublishingRef.current = true
      setIsPublishing(true)
      onStatusChange?.({ type: 'waiting' })

      // Get sender account
      const senderAccount = accounts.find(acc => acc.pubkey === selectedSender)
      if (!senderAccount) {
        throw new Error('Sender account not found')
      }

      // Get selected group
      const group = groups.find(g => g.id === selectedGroup)
      if (!group) {
        throw new Error('Group not found')
      }

      // Get group's public key from npub
      const receiverPublicKey = npubToHex(group.npub)

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

      if (result.success) {
        const newCount = eventCount + 1
        setEventCount(newCount)
        onStatusChange?.({ type: 'sent', count: newCount })

        // Flash success
        setTimeout(() => {
          if (!isCancelledRef.current) {
            onStatusChange?.({ type: 'sent', count: newCount })
          }
        }, 500)
      } else {
        throw new Error(result.error || 'Failed to publish')
      }
    } catch (error) {
      console.error('Failed to publish location:', error)
      onStatusChange?.({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' })

      toast({
        title: 'Failed to share location',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        status: 'error',
        duration: 5000,
      })
    } finally {
      isPublishingRef.current = false
      setIsPublishing(false)
    }
  }

  const handleShare = async () => {
    if (isPublishing) {
      // Cancel if already publishing
      isCancelledRef.current = true
      setIsPublishing(false)
      onStatusChange?.({ type: 'sent', count: eventCount })
      return
    }

    isCancelledRef.current = false
    startContinuousLocationUpdates()

    toast({
      title: 'Continuous sharing started',
      description: 'Location will be updated every 30 seconds',
      status: 'info',
      duration: 3000,
    })
  }

  const handleClose = () => {
    stopContinuousLocationUpdates()
    setEventCount(0)
    isCancelledRef.current = false
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
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                size="sm"
              >
                {groups.length === 0 ? (
                  <option value="">No groups available</option>
                ) : (
                  groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))
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

            {groups.length === 0 && (
              <Box p={2} bg="orange.50" borderRadius="md">
                <Text fontSize="sm" color="orange.800">
                  Please create or import a group first to share locations
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
            onClick={handleShare}
            isLoading={isPublishing}
            loadingText="Cancel"
            isDisabled={
              !geohash ||
              !selectedSender ||
              !selectedGroup ||
              accounts.length === 0 ||
              groups.length === 0 ||
              connectedRelays.length === 0
            }
          >
            Share
          </Button>
          <Button variant="ghost" onClick={handleClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}