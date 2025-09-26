import React, { useRef, useEffect, useState, useMemo } from 'react'
import {
  Box,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Collapse,
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
  Badge,
  Stack,
  Avatar,
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  VStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel
} from '@chakra-ui/react'
import { useNostr } from '../hooks/useNostr'
import { useAccounts } from 'applesauce-react/hooks'
import { useGroups } from '../hooks/useGroups'
import { useProfiles } from '../hooks/useProfiles'
import { mapService } from '../services/mapService'
import { AddLocationModal } from './AddLocationModal'
import * as nip19 from 'nostr-tools/nip19'

export function LocationsPage() {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isOpen: isResetOpen, onOpen: onResetOpen, onClose: onResetClose } = useDisclosure()
  const { isOpen: isHelpOpen, onOpen: onHelpOpen, onClose: onHelpClose } = useDisclosure()
  const { locationEvents, clearAllLocations, decryptLocationEvents } = useNostr()
  const accounts = useAccounts()
  const { groups } = useGroups()
  const toast = useToast()
  const cancelRef = useRef(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [selectedTab, setSelectedTab] = useState(0)

  // Collect all unique npubs from location events
  const allNpubs = useMemo(() => {
    const npubs = new Set<string>()
    locationEvents.forEach(event => {
      if (event.senderNpub) npubs.add(event.senderNpub)
      if (event.receiverNpub) npubs.add(event.receiverNpub)
    })
    return Array.from(npubs)
  }, [locationEvents])

  // Fetch profiles for all npubs
  const { profiles } = useProfiles(allNpubs)

  // Helper to convert npub to hex for profile lookup
  const npubToHex = (npub: string): string => {
    if (!npub || !npub.startsWith('npub')) return npub
    try {
      return nip19.decode(npub).data as string
    } catch {
      return npub
    }
  }

  // Helper to get profile for an npub
  const getProfile = (npub: string) => {
    if (!npub) return undefined
    const pubkey = npubToHex(npub)
    return profiles.get(pubkey)
  }

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

  const formatExpiry = (expiry: number | undefined) => {
    if (!expiry) return '—'

    const now = Math.floor(Date.now() / 1000)
    const remaining = expiry - now

    if (remaining <= 0) return 'Expired'

    // Convert to friendly units
    if (remaining < 60) {
      return `${remaining} s`
    } else if (remaining < 3600) {
      const minutes = Math.floor(remaining / 60)
      return `${minutes} min`
    } else if (remaining < 86400) {
      const hours = Math.floor(remaining / 3600)
      return `${hours} h`
    } else {
      const days = Math.floor(remaining / 86400)
      return `${days} d`
    }
  }

  const toggleRow = (eventId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(eventId)) {
        newSet.delete(eventId)
      } else {
        newSet.add(eventId)
      }
      return newSet
    })
  }

  // Get my npubs (from accounts and groups)
  const myNpubs = useMemo(() => {
    const npubs = new Set<string>()
    // Add account npubs
    accounts.forEach(account => {
      npubs.add(nip19.npubEncode(account.pubkey))
    })
    // Add group npubs
    groups.forEach(group => {
      npubs.add(group.npub)
    })
    return npubs
  }, [accounts, groups])

  // Categorize events
  const categorizedEvents = useMemo(() => {
    const shared: typeof locationEvents = []
    const contacts: typeof locationEvents = []
    const publicEvents: typeof locationEvents = []
    const encrypted: typeof locationEvents = []

    locationEvents.forEach(event => {
      // Public events
      if (event.eventKind === 30472) {
        publicEvents.push(event)
      }
      // Private events
      else if (event.eventKind === 30473) {
        // Still encrypted
        if (event.geohash === 'encrypted') {
          encrypted.push(event)
        }
        // Decrypted - check if shared by me or to me
        else {
          if (myNpubs.has(event.senderNpub)) {
            shared.push(event)
          } else if (event.receiverNpub && myNpubs.has(event.receiverNpub)) {
            contacts.push(event)
          }
        }
      }
    })

    return { shared, contacts, publicEvents, encrypted }
  }, [locationEvents, myNpubs])

  // Render location table component
  const LocationTable = ({ events, emptyMessage }: { events: typeof locationEvents, emptyMessage: string }) => {
    if (events.length === 0) {
      return (
        <Box p={8} textAlign="center">
          <Text color="gray.600">{emptyMessage}</Text>
        </Box>
      )
    }

    return (
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th width="30px"></Th>
            <Th>Name</Th>
            <Th>Geohash</Th>
            <Th>From → To</Th>
            <Th>Expires</Th>
          </Tr>
        </Thead>
        <Tbody>
          {events.map((event) => (
            <React.Fragment key={event.id}>
              <Tr
                cursor="pointer"
                _hover={{ bg: 'gray.50' }}
                onClick={() => toggleRow(event.id)}
              >
                <Td>
                  <Text fontSize="xs" transform={expandedRows.has(event.id) ? 'rotate(90deg)' : 'none'} transition="transform 0.2s">
                    ▶
                  </Text>
                </Td>
                <Td fontSize="xs">{event.name || event.dTag || '(default)'}</Td>
                <Td
                  fontFamily="mono"
                  fontSize="xs"
                  color={event.geohash !== 'encrypted' ? 'blue.600' : 'gray.500'}
                  textDecoration={event.geohash !== 'encrypted' ? 'underline' : 'none'}
                  onClick={(e) => {
                    e.stopPropagation()
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
                >
                  {event.geohash}
                </Td>
                <Td>
                  <HStack spacing={1}>
                    {(() => {
                      const senderProfile = getProfile(event.senderNpub)
                      return (
                        <Avatar
                          size="xs"
                          src={senderProfile?.picture}
                          name={senderProfile?.name || senderProfile?.display_name || event.senderNpub.slice(0, 16) + '...'}
                        />
                      )
                    })()}
                    <Text fontSize="md" color="gray.500">→</Text>
                    {event.eventKind === 30472 ? (
                      <Badge colorScheme="blue" size="sm">Public</Badge>
                    ) : event.receiverNpub ? (
                      (() => {
                        const receiverProfile = getProfile(event.receiverNpub)
                        return (
                          <Avatar
                            size="xs"
                            src={receiverProfile?.picture}
                            name={receiverProfile?.name || receiverProfile?.display_name || event.receiverNpub.slice(0, 16) + '...'}
                          />
                        )
                      })()
                    ) : (
                      <Badge colorScheme="orange" size="sm">Broadcast</Badge>
                    )}
                  </HStack>
                </Td>
                <Td fontSize="xs" color={formatExpiry(event.expiry) === 'Expired' ? 'red.500' : 'gray.700'}>
                  {formatExpiry(event.expiry)}
                </Td>
              </Tr>
              <Tr display={expandedRows.has(event.id) ? 'table-row' : 'none'}>
                <Td colSpan={5} bg="gray.50" p={4}>
                  <Collapse in={expandedRows.has(event.id)} animateOpacity>
                    <Stack spacing={2} fontSize="sm">
                      <HStack>
                        <Text color="gray.600" fontWeight="semibold">Event ID:</Text>
                        <Text fontFamily="mono">{event.eventId}</Text>
                      </HStack>
                      <HStack>
                        <Text color="gray.600" fontWeight="semibold">Created:</Text>
                        <Text>{formatTimestamp(event.created_at)}</Text>
                      </HStack>
                      <HStack>
                        <Text color="gray.600" fontWeight="semibold">Full Sender:</Text>
                        <Text fontFamily="mono" fontSize="xs">{event.senderNpub}</Text>
                      </HStack>
                      {event.receiverNpub && (
                        <HStack>
                          <Text color="gray.600" fontWeight="semibold">Full Recipient:</Text>
                          <Text fontFamily="mono" fontSize="xs">{event.receiverNpub}</Text>
                        </HStack>
                      )}
                    </Stack>
                  </Collapse>
                </Td>
              </Tr>
            </React.Fragment>
          ))}
        </Tbody>
      </Table>
    )
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <HStack spacing={3}>
          <Text fontSize="lg" fontWeight="bold" color="gray.800">Locations</Text>
          <Text fontSize="sm" color="gray.600">({locationEvents.length})</Text>
        </HStack>
        <HStack spacing={2}>
          <Tooltip label="Add Location" placement="bottom">
            <IconButton
              aria-label="Add Location"
              icon={<span style={{ fontSize: '2rem' }}>+</span>}
              size="sm"
              colorScheme="blue"
              onClick={onOpen}
            />
          </Tooltip>
          <Tooltip label="About Locations" placement="bottom">
            <IconButton
              aria-label="Help"
              icon={<span style={{ fontSize: '1.5rem' }}>?</span>}
              size="sm"
              colorScheme="blue"
              onClick={onHelpOpen}
            />
          </Tooltip>
          <Tooltip label="Clear All" placement="bottom">
            <IconButton
              aria-label="Clear all locations"
              icon={<span>🗑️</span>}
              size="sm"
              colorScheme="red"
              onClick={onResetOpen}
              isDisabled={locationEvents.length === 0}
            />
          </Tooltip>
        </HStack>
      </HStack>

      <Tabs index={selectedTab} onChange={setSelectedTab} variant="enclosed" colorScheme="blue">
        <TabList>
          <Tab>
            <HStack spacing={2}>
              <Text>Shared</Text>
              <Badge colorScheme="green" size="sm">{categorizedEvents.shared.length}</Badge>
            </HStack>
          </Tab>
          <Tab>
            <HStack spacing={2}>
              <Text>Contacts</Text>
              <Badge colorScheme="purple" size="sm">{categorizedEvents.contacts.length}</Badge>
            </HStack>
          </Tab>
          <Tab>
            <HStack spacing={2}>
              <Text>Public</Text>
              <Badge colorScheme="blue" size="sm">{categorizedEvents.publicEvents.length}</Badge>
            </HStack>
          </Tab>
          <Tab>
            <HStack spacing={2}>
              <Text>Encrypted</Text>
              <Badge colorScheme="orange" size="sm">{categorizedEvents.encrypted.length}</Badge>
            </HStack>
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel px={0}>
            <LocationTable
              events={categorizedEvents.shared}
              emptyMessage="No locations shared by you yet"
            />
          </TabPanel>
          <TabPanel px={0}>
            <LocationTable
              events={categorizedEvents.contacts}
              emptyMessage="No locations shared to you yet"
            />
          </TabPanel>
          <TabPanel px={0}>
            <LocationTable
              events={categorizedEvents.publicEvents}
              emptyMessage="No public location events"
            />
          </TabPanel>
          <TabPanel px={0}>
            <LocationTable
              events={categorizedEvents.encrypted}
              emptyMessage="No encrypted events awaiting decryption"
            />
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Add Location Modal */}
      <AddLocationModal
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

      {/* Help Modal */}
      <Modal isOpen={isHelpOpen} onClose={onHelpClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>About Locations</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text>
                Locations are encrypted position events shared on the Nostr network. They use
                NIP-30473 addressable events to share and update location data.
              </Text>

              <VStack align="stretch" spacing={2}>
                <Text fontSize="sm" fontWeight="semibold">Location Tabs:</Text>
                <HStack>
                  <Badge colorScheme="green">Shared</Badge>
                  <Text fontSize="sm">Locations you've shared with others</Text>
                </HStack>
                <HStack>
                  <Badge colorScheme="purple">Contacts</Badge>
                  <Text fontSize="sm">Locations shared with you</Text>
                </HStack>
                <HStack>
                  <Badge colorScheme="blue">Public</Badge>
                  <Text fontSize="sm">Public events visible to everyone</Text>
                </HStack>
                <HStack>
                  <Badge colorScheme="orange">Encrypted</Badge>
                  <Text fontSize="sm">Private events awaiting decryption</Text>
                </HStack>
              </VStack>

              <Text fontSize="sm" color="gray.600">
                Click on any location's geohash to focus it on the map. Expand rows to see
                full event details including event IDs and timestamps. Add identities or groups
                to decrypt encrypted events.
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onHelpClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}