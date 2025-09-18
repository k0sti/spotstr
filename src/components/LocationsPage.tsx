import { useState } from 'react'
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
  Checkbox
} from '@chakra-ui/react'
import { useNostr } from '../hooks/useNostr'
import { generateGeohash } from '../utils/crypto'
import { mapService } from '../services/mapService'

export function LocationsPage() {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { identities, locationEvents, addLocationEvent } = useNostr()
  const toast = useToast()
  const [geohash, setGeohash] = useState('')
  const [selectedSender, setSelectedSender] = useState('')
  const [selectedReceiver, setSelectedReceiver] = useState('')
  const [continuousUpdate, setContinuousUpdate] = useState(false)
  const [locationName, setLocationName] = useState('') // d-tag for addressable events

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

  const handleCreateLocation = () => {
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

    // Create addressable event ID based on NIP-01 spec
    // For addressable events (kind 30473), the d-tag defines uniqueness
    const dTag = locationName || '' // Empty string for single location per pubkey
    const senderPubkey = selectedSender // This is npub, would need conversion in real impl
    const addressableId = `30473:${senderPubkey}:${dTag}`
    
    const locationEvent = {
      id: addressableId, // Use addressable ID format
      eventId: crypto.randomUUID().replace(/-/g, '').slice(0, 16),
      created_at: Math.floor(Date.now() / 1000),
      senderNpub: selectedSender,
      receiverNpub: selectedReceiver,
      dTag, // Use the location name as d-tag (or empty for single location)
      geohash,
      expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      name: locationName || undefined, // Store the name for display
    }

    addLocationEvent(locationEvent)
    
    toast({
      title: 'Location created',
      description: 'Location event has been created',
      status: 'success',
      duration: 3000,
    })

    // Reset form
    setGeohash('')
    setSelectedSender('')
    setSelectedReceiver('')
    setContinuousUpdate(false)
    setLocationName('')
    onClose()
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Text fontSize="lg" fontWeight="bold" color="gray.800">Locations</Text>
        <Button onClick={onOpen} size="sm" colorScheme="blue">Create New +</Button>
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
    </Box>
  )
}