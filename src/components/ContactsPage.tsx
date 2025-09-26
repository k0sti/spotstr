import { useState, useEffect } from 'react'
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
  VStack,
  Text,
  useDisclosure,
  IconButton,
  useToast,
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Input,
  Avatar,
  Spinner,
  Flex,
  Progress
} from '@chakra-ui/react'
import { useContacts } from '../hooks/useContacts'
import { useAccounts } from 'applesauce-react/hooks'
import { IdentityDisplay } from './shared/IdentityDisplay'
import { KeyDisplay } from './shared/KeyDisplay'
import { fetchFollowList } from '../utils/fetchFollows'
import { fetchProfile } from '../utils/profileRelays'
import { hexToNpub } from '../utils/crypto'

// Contact Row Component
function ContactRow({
  contact,
  onDelete,
  onUpdateCustomName
}: {
  contact: any
  onDelete: (contact: any) => void
  onUpdateCustomName: (id: string, name: string) => void
}) {
  return (
    <Tr>
      <Td py={1} px={2}>
        <IdentityDisplay
          pubkey={contact.pubkey}
          metadata={contact.metadata}
          customName={contact.customName}
          onUpdateCustomName={(name) => onUpdateCustomName(contact.id, name)}
        />
      </Td>
      <Td py={1} px={2}>
        <KeyDisplay pubkey={contact.pubkey} showPrivateKey={false} />
      </Td>
      <Td py={1} px={2}>
        <Tooltip label="Delete contact">
          <IconButton
            aria-label="Delete"
            icon={<span>🗑️</span>}
            size="sm"
            colorScheme="red"
            variant="ghost"
            onClick={() => onDelete(contact)}
          />
        </Tooltip>
      </Td>
    </Tr>
  )
}

// Add Contact Modal
function AddContactModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [followList, setFollowList] = useState<Array<{ pubkey: string, profile?: any }>>([])
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [profileLoadProgress, setProfileLoadProgress] = useState({ loaded: 0, total: 0 })
  const [cachedFollows, setCachedFollows] = useState<Map<string, string[]>>(new Map())
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)
  const accounts = useAccounts()
  const { contacts, addMultipleContacts } = useContacts()
  const toast = useToast()

  // Cache duration: 5 minutes
  const CACHE_DURATION = 5 * 60 * 1000

  // Get existing contact pubkeys for filtering
  const existingContactPubkeys = new Set(contacts.map(c => c.pubkey))

  // Fetch follow list when modal opens
  useEffect(() => {
    if (isOpen && accounts.length > 0) {
      const now = Date.now()
      const cacheExpired = now - lastFetchTime > CACHE_DURATION

      // Only refetch if cache is expired or empty
      if (cacheExpired || followList.length === 0) {
        loadFollowList()
      } else {
        console.log('Using cached follow list')
      }
    }
  }, [isOpen])

  const loadFollowList = async (forceRefresh = false) => {
    setLoading(true)

    // Clear cache if forcing refresh
    if (forceRefresh) {
      setCachedFollows(new Map())
      setFollowList([])
      setSelectedContacts(new Set())
      console.log('Force refreshing follow lists...')
    }

    if (accounts.length === 0) {
      toast({
        title: 'No identities found',
        description: 'Please add an identity first',
        status: 'warning',
        duration: 3000,
      })
      setLoading(false)
      return
    }

    try {
      // Collect all follows from all identities
      const allFollows = new Set<string>()
      const identityNames: string[] = []

      // Fetch follow lists for all accounts
      for (const account of accounts) {
        let follows: string[] = []

        // Check cache first
        if (cachedFollows.has(account.pubkey)) {
          follows = cachedFollows.get(account.pubkey)!
          console.log(`Using cached follows for account ${account.pubkey}: ${follows.length} follows`)
        } else {
          console.log(`Fetching follows for account ${account.pubkey} (type: ${account.type})`)
          follows = await fetchFollowList(account.pubkey)

          // Cache the result
          if (follows.length > 0) {
            setCachedFollows(prev => new Map(prev).set(account.pubkey, follows))
          }
        }

        if (follows.length > 0) {
          console.log(`Found ${follows.length} follows for ${account.pubkey}`)
          follows.forEach(pubkey => allFollows.add(pubkey))

          // Track which identity contributed follows
          const name = account.metadata?.name || account.metadata?.display_name || hexToNpub(account.pubkey).slice(0, 12)
          identityNames.push(`${name} (${follows.length})`)
        }
      }

      // Update last fetch time
      setLastFetchTime(Date.now())

      if (identityNames.length > 0) {
        console.log(`Total unique follows from ${identityNames.length} identities: ${allFollows.size}`)
      }

      // Filter out existing contacts
      const newFollows = Array.from(allFollows).filter(pubkey => !existingContactPubkeys.has(pubkey))

      if (newFollows.length === 0) {
        if (allFollows.size === 0) {
          toast({
            title: 'No follows found',
            description: 'None of your identities have any follows',
            status: 'info',
            duration: 3000,
          })
        } else {
          toast({
            title: 'No new contacts',
            description: 'All your follows are already in your contacts',
            status: 'info',
            duration: 3000,
          })
        }
        setLoading(false)
        return
      }

      // Show which identities we're loading from
      if (identityNames.length > 0) {
        toast({
          title: 'Loading follows',
          description: `Found ${newFollows.length} new follows from: ${identityNames.join(', ')}`,
          status: 'success',
          duration: 5000,
        })
      }

      // Create follow objects
      const followObjects = newFollows.map(pubkey => ({ pubkey }))
      setFollowList(followObjects)
      setLoading(false)
      setLoadingProfiles(true)

      // Initialize progress tracking
      setProfileLoadProgress({ loaded: 0, total: followObjects.length })

      // Fetch profiles in batches
      const batchSize = 10
      let loadedCount = 0

      for (let i = 0; i < followObjects.length; i += batchSize) {
        const batch = followObjects.slice(i, i + batchSize)
        await Promise.all(
          batch.map(async (follow) => {
            const profile = await fetchProfile(follow.pubkey)
            if (profile) {
              setFollowList(prev => prev.map(f =>
                f.pubkey === follow.pubkey ? { ...f, profile } : f
              ))
            }
            // Update progress
            loadedCount++
            setProfileLoadProgress({ loaded: loadedCount, total: followObjects.length })
          })
        )
      }
      setLoadingProfiles(false)
      setProfileLoadProgress({ loaded: 0, total: 0 })
    } catch (error) {
      console.error('Failed to load follow list:', error)
      toast({
        title: 'Failed to load follows',
        description: 'Could not fetch your follow list',
        status: 'error',
        duration: 3000,
      })
      setLoading(false)
      setLoadingProfiles(false)
    }
  }

  const handleImport = async () => {
    if (selectedContacts.size === 0) {
      toast({
        title: 'No contacts selected',
        description: 'Please select contacts to import',
        status: 'warning',
        duration: 3000,
      })
      return
    }

    const npubList = Array.from(selectedContacts).map(pubkey => hexToNpub(pubkey))
    const { added, failed } = await addMultipleContacts(npubList)

    if (added.length > 0) {
      toast({
        title: 'Contacts imported',
        description: `Added ${added.length} contact(s)`,
        status: 'success',
        duration: 3000,
      })
      handleClose()
    }

    if (failed.length > 0) {
      toast({
        title: 'Some contacts failed',
        description: `${failed.length} contact(s) could not be added`,
        status: 'warning',
        duration: 3000,
      })
    }
  }

  const handleClose = () => {
    setSearchQuery('')
    setFollowList([])
    setSelectedContacts(new Set())
    onClose()
  }

  const toggleContact = (pubkey: string) => {
    const newSelected = new Set(selectedContacts)
    if (newSelected.has(pubkey)) {
      newSelected.delete(pubkey)
    } else {
      newSelected.add(pubkey)
    }
    setSelectedContacts(newSelected)
  }

  // Filter and sort follow list based on search and selection
  const filteredFollows = followList
    .filter(follow => {
      // Hide selected items from the list
      if (selectedContacts.has(follow.pubkey)) return false

      // Apply search filter
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      const name = follow.profile?.name?.toLowerCase() || ''
      const displayName = follow.profile?.display_name?.toLowerCase() || ''
      const npub = hexToNpub(follow.pubkey).toLowerCase()
      return name.includes(query) || displayName.includes(query) || npub.includes(query)
    })
    .sort((a, b) => {
      // Sort by profile name (profiles with names come first)
      const nameA = (a.profile?.name || a.profile?.display_name || '').toLowerCase()
      const nameB = (b.profile?.name || b.profile?.display_name || '').toLowerCase()

      // Profiles without names go to the end
      if (!nameA && nameB) return 1
      if (nameA && !nameB) return -1

      // Both have names or both don't have names
      return nameA.localeCompare(nameB)
    })

  // Get selected contact profiles for preview (sorted by name)
  const selectedProfiles = followList
    .filter(f => selectedContacts.has(f.pubkey))
    .sort((a, b) => {
      const nameA = (a.profile?.name || a.profile?.display_name || '').toLowerCase()
      const nameB = (b.profile?.name || b.profile?.display_name || '').toLowerCase()

      // Profiles without names go to the end
      if (!nameA && nameB) return 1
      if (nameA && !nameB) return -1

      return nameA.localeCompare(nameB)
    })

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <ModalOverlay />
      <ModalContent maxHeight="80vh">
        <ModalHeader>Add Contacts from Follows</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* Search input */}
            <Input
              placeholder="Search by name or npub..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              isDisabled={loading}
            />

            {/* Follow list */}
            <Box>
              <HStack justify="space-between" mb={2}>
                <HStack spacing={2}>
                  <Text fontSize="sm" fontWeight="bold">
                    Your Follows
                  </Text>
                  {lastFetchTime > 0 && !loading && (
                    <Tooltip label="Refresh follow lists">
                      <IconButton
                        size="xs"
                        aria-label="Refresh"
                        icon={<span>🔄</span>}
                        variant="ghost"
                        onClick={() => loadFollowList(true)}
                        isDisabled={loading}
                      />
                    </Tooltip>
                  )}
                </HStack>
                {loadingProfiles && (
                  <VStack spacing={1} align="end">
                    <HStack spacing={2}>
                      <Spinner size="xs" />
                      <Text fontSize="xs" color="gray.500">
                        Loading profiles... ({profileLoadProgress.loaded}/{profileLoadProgress.total})
                      </Text>
                    </HStack>
                    <Progress
                      value={(profileLoadProgress.loaded / profileLoadProgress.total) * 100}
                      size="xs"
                      colorScheme="blue"
                      width="150px"
                      borderRadius="md"
                    />
                  </VStack>
                )}
              </HStack>

              <Box
                maxHeight="300px"
                overflowY="auto"
                borderWidth={1}
                borderRadius="md"
                p={2}
              >
                {loading ? (
                  <HStack justify="center" p={4}>
                    <Spinner />
                    <Text>Loading follow list...</Text>
                  </HStack>
                ) : filteredFollows.length === 0 ? (
                  <Text textAlign="center" color="gray.500" p={4}>
                    {searchQuery ? 'No matches found' :
                     selectedContacts.size > 0 ? 'All available follows selected' : 'No follows found'}
                  </Text>
                ) : (
                  <VStack spacing={1} align="stretch">
                    {filteredFollows.map(follow => (
                      <HStack
                        key={follow.pubkey}
                        p={2}
                        borderRadius="md"
                        _hover={{ bg: 'gray.50' }}
                        cursor="pointer"
                        onClick={() => toggleContact(follow.pubkey)}
                      >
                        <Avatar
                          size="sm"
                          src={follow.profile?.picture}
                          name={follow.profile?.name || hexToNpub(follow.pubkey).slice(0, 8)}
                        />
                        <VStack align="start" flex={1} spacing={0}>
                          <Text fontSize="sm" fontWeight="medium">
                            {follow.profile?.name || 'Unknown'}
                          </Text>
                          <Text fontSize="xs" color="gray.500" isTruncated maxWidth="300px">
                            {hexToNpub(follow.pubkey)}
                          </Text>
                        </VStack>
                      </HStack>
                    ))}
                  </VStack>
                )}
              </Box>
            </Box>

            {/* Selected contacts preview */}
            {selectedContacts.size > 0 && (
              <Box>
                <Text fontSize="sm" fontWeight="bold" mb={2}>
                  Selected ({selectedContacts.size})
                </Text>
                <Flex
                  wrap="wrap"
                  gap={2}
                  p={2}
                  borderWidth={1}
                  borderRadius="md"
                  maxHeight="100px"
                  overflowY="auto"
                >
                  {selectedProfiles.map(follow => (
                    <Tooltip
                      key={follow.pubkey}
                      label={follow.profile?.name || hexToNpub(follow.pubkey).slice(0, 12)}
                    >
                      <Avatar
                        size="sm"
                        src={follow.profile?.picture}
                        name={follow.profile?.name || hexToNpub(follow.pubkey).slice(0, 8)}
                        cursor="pointer"
                        onClick={() => toggleContact(follow.pubkey)}
                      />
                    </Tooltip>
                  ))}
                </Flex>
              </Box>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button
              colorScheme="blue"
              onClick={handleImport}
              isDisabled={selectedContacts.size === 0}
            >
              Import {selectedContacts.size > 0 && `(${selectedContacts.size})`}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export function ContactsPage() {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isOpen: isHelpOpen, onOpen: onHelpOpen, onClose: onHelpClose } = useDisclosure()
  const { contacts, deleteContact, updateCustomName } = useContacts()
  const toast = useToast()

  const handleDeleteContact = (contact: any) => {
    deleteContact(contact.id)
    toast({
      title: 'Contact deleted',
      description: `Removed ${contact.customName || contact.metadata?.name || 'contact'}`,
      status: 'info',
      duration: 3000,
    })
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <HStack spacing={3}>
          <Text fontSize="lg" fontWeight="bold" color="gray.800">Contacts</Text>
          <Text fontSize="sm" color="gray.600">({contacts.length})</Text>
        </HStack>
        <HStack spacing={2}>
          <Tooltip label="Add Contact" placement="bottom">
            <IconButton
              aria-label="Add Contact"
              icon={<span style={{ fontSize: '2rem' }}>+</span>}
              size="sm"
              colorScheme="blue"
              onClick={onOpen}
            />
          </Tooltip>
          <Tooltip label="About Contacts" placement="bottom">
            <IconButton
              aria-label="Help"
              icon={<span style={{ fontSize: '1.5rem' }}>?</span>}
              size="sm"
              colorScheme="blue"
              onClick={onHelpOpen}
            />
          </Tooltip>
        </HStack>
      </HStack>

      {contacts.length === 0 ? (
        <Box p={8} textAlign="center">
          <Text color="gray.600" mb={4}>No contacts yet</Text>
          <Button onClick={onOpen} size="sm" colorScheme="blue">
            Add your first contact
          </Button>
        </Box>
      ) : (
        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th py={1} px={2}>Profile</Th>
              <Th py={1} px={2}>Key</Th>
              <Th py={1} px={2}>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {contacts.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                onDelete={handleDeleteContact}
                onUpdateCustomName={updateCustomName}
              />
            ))}
          </Tbody>
        </Table>
      )}

      {/* Add Contact Modal */}
      <AddContactModal isOpen={isOpen} onClose={onClose} />

      {/* Help Modal */}
      <Modal isOpen={isHelpOpen} onClose={onHelpClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>About Contacts</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text>
                Contacts are Nostr profiles that you can share locations with. They are stored locally
                in your browser and can be imported from your Nostr follow list.
              </Text>

              <VStack align="stretch" spacing={2}>
                <Text fontSize="sm" fontWeight="semibold">Key Features:</Text>
                <Text fontSize="sm">• Import contacts from your Nostr follow list</Text>
                <Text fontSize="sm">• Add custom names to help identify contacts</Text>
                <Text fontSize="sm">• View contact public keys (npub)</Text>
                <Text fontSize="sm">• Share locations privately with specific contacts</Text>
              </VStack>

              <Text fontSize="sm" color="gray.600">
                When you share a location with a contact, it's encrypted using their public key.
                Only they can decrypt and view the location using their private key.
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