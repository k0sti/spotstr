import { useRef, useEffect } from 'react'
import {
  Box,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  HStack,
  Text,
  useDisclosure,
  useToast,
  IconButton,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  AlertDialogCloseButton,
  Badge
} from '@chakra-ui/react'
import { useNostr } from '../hooks/useNostr'
import { useAccounts } from 'applesauce-react/hooks'
import { useGroups } from '../hooks/useGroups'
import { mapService } from '../services/mapService'
import { ShareLocationPopup } from './ShareLocationPopup'

export function LocationsPage() {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isOpen: isResetOpen, onOpen: onResetOpen, onClose: onResetClose } = useDisclosure()
  const { locationEvents, clearAllLocations, decryptLocationEvents } = useNostr()
  const accounts = useAccounts()
  const { groups } = useGroups()
  const toast = useToast()
  const cancelRef = useRef(null)

  // Decrypt location events when accounts or groups are available or when new events arrive
  useEffect(() => {
    if (accounts.length > 0 || groups.length > 0) {
      // Initial decryption with both accounts and groups
      decryptLocationEvents(accounts)
    }
  }, [accounts, groups, decryptLocationEvents])

  // Also trigger decryption when location events change
  useEffect(() => {
    if ((accounts.length > 0 || groups.length > 0) && locationEvents.some(e => e.geohash === 'encrypted')) {
      decryptLocationEvents(accounts)
    }
  }, [locationEvents, accounts, groups, decryptLocationEvents])

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  // Count public and private events
  const publicCount = locationEvents.filter(e => e.eventKind === 30472).length
  const privateCount = locationEvents.filter(e => e.eventKind === 30473).length
  const encryptedCount = locationEvents.filter(e => e.geohash === 'encrypted').length

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <HStack spacing={3}>
          <Text fontSize="lg" fontWeight="bold" color="gray.800">Locations</Text>
          <HStack spacing={2} fontSize="sm">
            <Text color="gray.600">Total: {locationEvents.length}</Text>
            {publicCount > 0 && (
              <Badge colorScheme="blue" variant="subtle">Public: {publicCount}</Badge>
            )}
            {privateCount > 0 && (
              <Badge colorScheme="red" variant="subtle">Private: {privateCount}</Badge>
            )}
            {encryptedCount > 0 && (
              <Badge colorScheme="orange" variant="subtle">Encrypted: {encryptedCount}</Badge>
            )}
          </HStack>
        </HStack>
        <HStack spacing={2}>
          <Button onClick={onOpen} size="sm" colorScheme="blue">Share Location +</Button>
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
            <Th>Recipient</Th>
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
              <Td fontSize="xs">
                {event.eventKind === 30472 ? (
                  <Badge colorScheme="blue">Public</Badge>
                ) : (
                  <Text fontFamily="mono" display="inline">
                    {event.receiverNpub ? event.receiverNpub.slice(0, 8) + '...' : '(broadcast)'}
                  </Text>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {/* Share Location Popup */}
      <ShareLocationPopup
        isOpen={isOpen}
        onClose={onClose}
      />

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