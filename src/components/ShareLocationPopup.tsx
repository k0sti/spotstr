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
  Switch,
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

interface ShareLocationPopupProps {
  isOpen: boolean
  onClose: () => void
  initialGeohash?: string
}

export function ShareLocationPopup({ isOpen, onClose, initialGeohash = '' }: ShareLocationPopupProps) {
  const toast = useToast()
  const accounts = useAccounts()
  const { publishLocationEvent, connectedRelays } = useNostr()
  const { groups } = useGroups()

  const [geohash, setGeohash] = useState(initialGeohash)
  const [continuousUpdate, setContinuousUpdate] = useState(false)
  const [selectedSender, setSelectedSender] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [locationName, setLocationName] = useState('')
  const [accuracy, setAccuracy] = useState<number>(100)

  const watchIdRef = useRef<number | null>(null)
  const intervalIdRef = useRef<number | null>(null)
  const isPublishingRef = useRef(false)

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
      if (watchIdRef.current !== null) {
        const geolocation = getGeolocationImplementation()
        geolocation.clearWatch(watchIdRef.current)
      }
      if (intervalIdRef.current) {
        window.clearInterval(intervalIdRef.current)
      }
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

        // Update accuracy if available
        if (position.coords.accuracy) {
          setAccuracy(Math.round(position.coords.accuracy))
        }
      },
      (error) => {
        console.error('[Location Error]', error)
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

    // Publish location every 30 seconds
    intervalIdRef.current = window.setInterval(() => {
      if (geohash && !isPublishingRef.current) {
        publishLocation()
      }
    }, 30000)
  }

  const stopContinuousLocationUpdates = () => {
    if (watchIdRef.current !== null) {
      const geolocation = getGeolocationImplementation()
      geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (intervalIdRef.current) {
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

        // Update accuracy if available
        if (position.coords.accuracy) {
          setAccuracy(Math.round(position.coords.accuracy))
        }

        toast({
          title: 'Location obtained',
          status: 'success',
          duration: 2000,
        })
      },
      (error) => {
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

      // Prepare location data tags
      const locationTags: string[][] = [['g', geohash]]
      if (accuracy > 0) {
        locationTags.push(['accuracy', accuracy.toString()])
      }
      if (locationName) {
        locationTags.push(['name', locationName])
      }

      // Encrypt location data
      let encryptedContent: string

      // Use account's signer for encryption
      if (senderAccount.signer.nip44?.encrypt) {
        encryptedContent = await senderAccount.signer.nip44.encrypt(
          receiverPublicKey,
          JSON.stringify(locationTags)
        )
      } else if (senderAccount.type === 'amber-clipboard') {
        // For Amber, use the clipboard API for encryption
        const plaintext = JSON.stringify(locationTags)
        const intentUrl = `nostrsigner:${encodeURIComponent(plaintext)}?pubkey=${receiverPublicKey}&compressionType=none&returnType=signature&type=nip44_encrypt`

        // Store current clipboard content
        const originalClipboard = await navigator.clipboard.readText().catch(() => '')

        // Show toast to guide user
        toast({
          title: 'Opening Amber',
          description: 'Please approve the encryption request in Amber',
          status: 'info',
          duration: 5000,
        })

        // Open Amber for encryption
        window.location.href = intentUrl

        // Wait for encrypted content to be copied to clipboard
        encryptedContent = await new Promise((resolve, reject) => {
          const checkClipboard = async () => {
            const clipboardContent = await navigator.clipboard.readText().catch(() => '')

            if (clipboardContent && clipboardContent !== originalClipboard) {
              resolve(clipboardContent)
            }
          }

          // Check clipboard when page regains focus
          const handleFocus = () => {
            setTimeout(checkClipboard, 500)
          }

          window.addEventListener('focus', handleFocus, { once: true })

          // Timeout after 30 seconds
          setTimeout(() => {
            window.removeEventListener('focus', handleFocus)
            reject(new Error('Amber encryption timeout'))
          }, 30000)
        })
      } else {
        throw new Error('Account does not support NIP-44 encryption')
      }

      // Create the Nostr event
      const dTag = locationName || `${Date.now()}` // Use timestamp if no name
      const expiry_ms = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now

      const unsignedEvent = {
        kind: 30473, // NIP-location addressable event kind
        pubkey: senderAccount.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', dTag], // Addressable event identifier
          ['p', receiverPublicKey], // Recipient
          ['expiry', expiry_ms.toString()], // Expiry time
        ],
        content: encryptedContent,
      }

      // Publish the event to connected relays
      await publishLocationEvent(unsignedEvent, connectedRelays, senderAccount.signer)

      toast({
        title: 'Location shared',
        description: continuousUpdate ? 'Location updates started' : 'Location published',
        status: 'success',
        duration: 3000,
      })

      // If not continuous, close the modal
      if (!continuousUpdate) {
        onClose()
      }
    } catch (error) {
      console.error('Failed to publish location:', error)
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
    if (continuousUpdate) {
      // Start continuous updates
      await publishLocation() // Publish once immediately
      startContinuousLocationUpdates()
      toast({
        title: 'Continuous updates started',
        description: 'Location will be updated every 30 seconds',
        status: 'info',
        duration: 3000,
      })
    } else {
      // Single update
      await publishLocation()
    }
  }

  const handleClose = () => {
    stopContinuousLocationUpdates()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Share Location</ModalHeader>
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

            {/* <FormControl>
              <FormLabel fontSize="sm">Accuracy (meters)</FormLabel>
              <Input
                type="number"
                value={accuracy || ''}
                onChange={(e) => setAccuracy(parseInt(e.target.value) || 0)}
                size="sm"
              />
            </FormControl> */}

            <FormControl display="flex" alignItems="center">
              <FormLabel fontSize="sm" mb={0}>
                Continuous update
              </FormLabel>
              <Switch
                isChecked={continuousUpdate}
                onChange={(e) => setContinuousUpdate(e.target.checked)}
                colorScheme="blue"
                size="sm"
              />
            </FormControl>
            {continuousUpdate && (
              <Text fontSize="xs" color="gray.500" mt={-2}>
                Will track device location and update every 30 seconds
              </Text>
            )}

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
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}