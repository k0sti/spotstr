import { useState, useRef } from 'react'
import { 
  Box, 
  Button, 
  Table, 
  Thead, 
  Tbody, 
  Tr, 
  Th, 
  Td,
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
  Text,
  useDisclosure,
  useToast,
  Checkbox,
  IconButton,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  AlertDialogCloseButton
} from '@chakra-ui/react'
import { useNostr } from '../hooks/useNostr'
import { generateGeohash } from '../utils/crypto'
import { mapService } from '../services/mapService'

export function LocationsPage() {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isOpen: isResetOpen, onOpen: onResetOpen, onClose: onResetClose } = useDisclosure()
  const { identities, locationEvents, clearAllLocations, publishLocationEvent, connectedRelays } = useNostr()
  const toast = useToast()
  const cancelRef = useRef(null)
  const [geohash, setGeohash] = useState('')
  const [selectedSender, setSelectedSender] = useState('')
  const [selectedReceiver, setSelectedReceiver] = useState('')
  const [continuousUpdate, setContinuousUpdate] = useState(false)
  const [locationName, setLocationName] = useState('') // d-tag for addressable events
  const [accuracy, setAccuracy] = useState<number>(100) // Default 100m accuracy

  // Filter identities with nsec for sender selection
  const identitiesWithNsec = identities.filter(id => id.nsec)

  const queryDeviceLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Location not supported',
        description: 'Your browser does not support geolocation',
        status: 'error',
        duration: 3000,
      })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const hash = generateGeohash(latitude, longitude)
        setGeohash(hash)
        toast({
          title: 'Location obtained',
          description: `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`,
          status: 'success',
          duration: 3000,
        })
      },
      (error) => {
        toast({
          title: 'Location error',
          description: error.message,
          status: 'error',
          duration: 3000,
        })
      }
    )
  }

  const handleCreateLocation = async () => {
    if (!geohash) {
      toast({
        title: 'Geohash required',
        description: 'Please enter a geohash or query device location',
        status: 'warning',
        duration: 3000,
      })
      return
    }

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

    try {
      // Import necessary functions for creating Nostr events
      const { npubToHex } = await import('../utils/crypto')
      const nip44 = await import('nostr-tools/nip44')
      const { getPublicKey } = await import('nostr-tools/pure')
      const nip19 = await import('nostr-tools/nip19')

      // Get sender identity with private key
      const senderIdentity = identities.find(id => id.npub === selectedSender && id.nsec)
      if (!senderIdentity || !senderIdentity.nsec) {
        throw new Error('Sender identity not found or has no private key')
      }

      // Decode sender's private key
      const senderSecretKeyDecoded = nip19.decode(senderIdentity.nsec)
      if (senderSecretKeyDecoded.type !== 'nsec') {
        throw new Error('Invalid nsec')
      }
      const senderSecretKey = senderSecretKeyDecoded.data as Uint8Array
      const senderPublicKey = getPublicKey(senderSecretKey)

      // Get receiver's public key
      const receiverPublicKey = npubToHex(selectedReceiver)
      if (!receiverPublicKey) {
        throw new Error('Invalid receiver npub')
      }

      // Create conversation key for NIP-44 encryption
      const conversationKey = nip44.v2.utils.getConversationKey(
        senderSecretKey,
        receiverPublicKey
      )

      // Prepare location data tags
      const locationTags: string[][] = [['g', geohash]]
      if (accuracy > 0) {
        locationTags.push(['accuracy', accuracy.toString()])
      }
      if (locationName) {
        locationTags.push(['name', locationName])
      }

      // Encrypt location data
      const encryptedContent = nip44.v2.encrypt(
        JSON.stringify(locationTags),
        conversationKey
      )

      // Create the Nostr event
      const dTag = locationName || '' // Empty string for single location per pubkey
      const expiry_ms = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now

      const unsignedEvent = {
        kind: 30473, // NIP-location addressable event kind
        pubkey: senderPublicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', dTag], // Addressable event identifier
          ['p', receiverPublicKey], // Recipient
          ['expiry', expiry_ms.toString()], // Expiry time
        ],
        content: encryptedContent,
      }

      // Publish the event to connected relays
      // The event will be added to local storage automatically when received back from the relay
      await publishLocationEvent(unsignedEvent, connectedRelays)

      toast({
        title: 'Location published',
        description: `Location event has been published to ${connectedRelays.length} relay(s)`,
        status: 'success',
        duration: 3000,
      })

      // Reset form
      setGeohash('')
      setSelectedSender('')
      setSelectedReceiver('')
      setContinuousUpdate(false)
      setLocationName('')
      setAccuracy(100)
      onClose()
    } catch (error) {
      console.error('Failed to create/publish location:', error)
      toast({
        title: 'Failed to publish location',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        status: 'error',
        duration: 5000,
      })
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Text fontSize="lg" fontWeight="bold" color="gray.800">Locations</Text>
        <HStack spacing={2}>
          <Button onClick={onOpen} size="sm" colorScheme="blue">Create New +</Button>
          <IconButton
            aria-label="Clear all locations"
            icon={<span>🗑️</span>}
            size="sm"
            colorScheme="red"
            variant="outline"
            onClick={onResetOpen}
            isDisabled={locationEvents.length === 0}
          />
        </HStack>
      </HStack>

      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Geohash</Th>
            <Th>Event ID</Th>
            <Th>Created At</Th>
            <Th>Sender</Th>
            <Th>Receiver</Th>
          </Tr>
        </Thead>
        <Tbody>
          {locationEvents.map((event) => (
            <Tr 
              key={event.id}
              onClick={() => {
                if (event.geohash !== 'encrypted') {
                  mapService.focusLocation(event.id)
                  toast({
                    title: 'Map focused',
                    description: `Focused on location: ${event.name || event.dTag || 'unnamed'}`,
                    status: 'info',
                    duration: 2000,
                  })
                }
              }}
              cursor={event.geohash !== 'encrypted' ? 'pointer' : 'default'}
              _hover={event.geohash !== 'encrypted' ? { bg: 'gray.50' } : {}}
            >
              <Td fontSize="xs">{event.name || event.dTag || '(default)'}</Td>
              <Td 
                fontFamily="mono" 
                fontSize="xs"
                color={event.geohash !== 'encrypted' ? 'blue.600' : 'gray.500'}
                textDecoration={event.geohash !== 'encrypted' ? 'underline' : 'none'}
              >
                {event.geohash}
              </Td>
              <Td fontFamily="mono" fontSize="xs">{event.eventId.slice(0, 8)}...</Td>
              <Td fontSize="xs">{formatTimestamp(event.created_at)}</Td>
              <Td fontFamily="mono" fontSize="xs">{event.senderNpub.slice(0, 8)}...</Td>
              <Td fontFamily="mono" fontSize="xs">{event.receiverNpub ? event.receiverNpub.slice(0, 8) + '...' : '(broadcast)'}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {/* Create Location Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create Location</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <Input 
                placeholder="Location name (optional, e.g., 'home', 'office')" 
                aria-label="Location name"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
              />
              <Text fontSize="xs" color="gray.500">
                Leave empty for single location, or name it for multiple locations
              </Text>
              <Input 
                placeholder="Geohash" 
                aria-label="Geohash"
                value={geohash}
                onChange={(e) => setGeohash(e.target.value)}
              />
              <Button size="sm" onClick={queryDeviceLocation} colorScheme="teal">
                Query Device Location
              </Button>
              <Checkbox
                isChecked={continuousUpdate}
                onChange={(e) => setContinuousUpdate(e.target.checked)}
              >
                Continuous update
              </Checkbox>
              <Input 
                type="number"
                placeholder="Accuracy (meters)" 
                aria-label="Accuracy"
                value={accuracy || ''}
                onChange={(e) => setAccuracy(parseInt(e.target.value) || 0)}
              />
              <Select 
                placeholder="Select Sender (with keys)" 
                aria-label="Sender"
                value={selectedSender}
                onChange={(e) => setSelectedSender(e.target.value)}
              >
                {identitiesWithNsec.map((identity) => (
                  <option key={identity.id} value={identity.npub}>
                    {identity.name || 'Unnamed'} ({identity.npub.slice(0, 8)}...)
                  </option>
                ))}
              </Select>
              <Select 
                placeholder="Select Receiver" 
                aria-label="Receiver"
                value={selectedReceiver}
                onChange={(e) => setSelectedReceiver(e.target.value)}
              >
                {identities.map((identity) => (
                  <option key={identity.id} value={identity.npub}>
                    {identity.name || 'Unnamed'} ({identity.npub.slice(0, 8)}...)
                  </option>
                ))}
              </Select>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={handleCreateLocation}>
              Create
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Reset Confirmation Dialog */}
      <AlertDialog
        isOpen={isResetOpen}
        leastDestructiveRef={cancelRef}
        onClose={onResetClose}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Clear All Locations
            </AlertDialogHeader>
            <AlertDialogCloseButton />

            <AlertDialogBody>
              <Text>Are you sure you want to clear all location events?</Text>
              <Text fontSize="sm" color="gray.600" mt={2}>
                This will remove {locationEvents.length} location{locationEvents.length !== 1 ? 's' : ''} from your local storage.
                This action cannot be undone.
              </Text>
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onResetClose}>
                Cancel
              </Button>
              <Button 
                colorScheme="red" 
                onClick={() => {
                  clearAllLocations()
                  toast({
                    title: 'Locations cleared',
                    description: 'All location events have been removed',
                    status: 'success',
                    duration: 3000,
                  })
                  onResetClose()
                }} 
                ml={3}
              >
                Clear All
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  )
}