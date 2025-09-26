import { useState, useEffect, useMemo } from 'react'
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
  Text,
  useDisclosure,
  IconButton,
  useToast,
  Badge,
  ButtonGroup,
  Link,
  Divider,
  Spinner,
  Tooltip
} from '@chakra-ui/react'
import { useAccountManager, useAccounts } from 'applesauce-react/hooks'
import { ExtensionAccount, SimpleAccount, NostrConnectAccount } from 'applesauce-accounts/accounts'
import { ExtensionSigner, SimpleSigner, NostrConnectSigner } from 'applesauce-signers'
import { generateNostrKeyPair } from '../utils/crypto'
import { fetchProfile } from '../utils/profileRelays'
import { useAccountCustomNames } from '../hooks/useAccountCustomNames'
import { IdentityDisplay } from './shared/IdentityDisplay'
import { KeyDisplay } from './shared/KeyDisplay'

// Check if we're on Android
const IS_WEB_ANDROID = /android/i.test(navigator.userAgent)

// Helper functions
const getAccountTypeBadgeColor = (type: string) => {
  switch (type) {
    case 'simple': return 'green'
    case 'nsec': return 'green'  // SimpleAccount uses 'nsec' as type
    case 'extension': return 'orange'
    case 'amber-clipboard': return 'yellow'
    case 'nostr-connect': return 'teal'
    default: return 'gray'
  }
}

const getAccountTypeLabel = (type: string, metadata?: any) => {
  switch (type) {
    case 'simple': return 'Temporary'
    case 'nsec': return 'Temporary'  // SimpleAccount uses 'nsec' as type
    case 'extension': return 'Extension'
    case 'amber-clipboard': return 'Amber'
    case 'nostr-connect': {
      // Check if this is an Amber connection based on metadata
      if (metadata?._isAmber) return 'Amber'
      return 'Bunker'
    }
    default: return type
  }
}

// Identity Row Component
function IdentityRow({ account, onDelete, customName, onUpdateCustomName }: {
  account: any
  onDelete: (account: any) => void
  customName?: string
  onUpdateCustomName: (pubkey: string, name: string) => void
}) {
  // Check if account has access to private key (only simple accounts have it)
  const secretKey = account.metadata?._secretKey

  // Create the badge element
  const badge = (
    <Badge colorScheme={getAccountTypeBadgeColor(account.type)} size="sm">
      {getAccountTypeLabel(account.type, account.metadata)}
    </Badge>
  )

  return (
    <Tr>
      <Td py={1} px={1}>
        <IdentityDisplay
          pubkey={account.pubkey}
          metadata={account.metadata}
          customName={customName}
          onUpdateCustomName={(name) => onUpdateCustomName(account.pubkey, name)}
        />
      </Td>
      <Td py={1} px={2}>
        <KeyDisplay
          pubkey={account.pubkey}
          secretKey={secretKey}
          showPrivateKey={!!secretKey}
          badge={badge}
        />
      </Td>
      <Td py={1} px={2}>
        <IconButton
          size="xs"
          aria-label="Delete identity"
          icon={<span>🗑️</span>}
          colorScheme="red"
          variant="ghost"
          onClick={() => onDelete(account)}
        />
      </Td>
    </Tr>
  )
}

export function IdentitiesPage() {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isOpen: isHelpOpen, onOpen: onHelpOpen, onClose: onHelpClose } = useDisclosure()
  const manager = useAccountManager()
  const accountsList = useAccounts()
  const { customNames, setCustomName } = useAccountCustomNames()
  const toast = useToast()
  const [nameInput, setNameInput] = useState('')
  const [bunkerUri, setBunkerUri] = useState('')
  const [isConnectingBunker, setIsConnectingBunker] = useState(false)
  const [amberSigner, setAmberSigner] = useState<NostrConnectSigner | null>(null)
  const [showAmberModal, setShowAmberModal] = useState(false)
  const [isAmberConnecting, setIsAmberConnecting] = useState(false)

  // Extension login
  const handleWebExtensionLogin = async () => {
    try {
      if (!window.nostr) {
        toast({
          title: 'Extension not found',
          description: 'Please install a Nostr browser extension like Alby, nos2x, or Flamingo',
          status: 'warning',
          duration: 5000,
        })
        return
      }

      const signer = new ExtensionSigner()
      const pubkey = await signer.getPublicKey()

      // Get the existing account or create a new one
      const existingAccount = manager.accounts.find((a) => a.type === ExtensionAccount.type && a.pubkey === pubkey)

      if (existingAccount) {
        toast({
          title: 'Already added',
          description: 'This extension account is already added',
          status: 'info',
          duration: 3000,
        })
        onClose()
        return
      }

      const account = new ExtensionAccount(pubkey, signer)

      // Fetch profile data from relays
      toast({
        title: 'Fetching profile',
        description: 'Loading profile information from relays...',
        status: 'info',
        duration: 2000,
      })

      const profile = await fetchProfile(pubkey)
      if (profile) {
        // Store profile data in account metadata
        account.metadata = {
          ...profile,
          display_name: profile.display_name,
          name: profile.name,
          picture: profile.picture,
          about: profile.about,
          nip05: profile.nip05
        }
        console.log('Fetched profile for extension account:', profile)
      } else {
        account.metadata = {}
      }

      manager.addAccount(account)

      toast({
        title: 'Extension connected',
        description: profile?.name ?
          `Connected as ${profile.name}` :
          'Successfully connected to browser extension',
        status: 'success',
        duration: 3000,
      })

      onClose()
    } catch (error) {
      console.error('Extension login error:', error)
      toast({
        title: 'Extension error',
        description: error instanceof Error ? error.message : 'Failed to connect to extension',
        status: 'error',
        duration: 5000,
      })
    }
  }

  // Amber login (for Android) - show modal with QR code
  const handleAmberLogin = () => {
    if (!IS_WEB_ANDROID) {
      toast({
        title: 'Android only',
        description: 'Amber signer is only available on Android devices',
        status: 'info',
        duration: 4000,
      })
      return
    }

    // Create NostrConnect signer for Amber with better relay configuration
    const signer = new NostrConnectSigner({
      relays: ['wss://relay.nsec.app', 'wss://relay.damus.io']
    })

    setAmberSigner(signer)
    setShowAmberModal(true)
    onClose() // Close the main modal
  }

  // Connection URI for Amber
  const amberConnectionURI = useMemo(() => {
    if (!amberSigner) return ''

    return amberSigner.getNostrConnectURI({
      name: 'Spotstr',
      url: window.location.origin,
      image: new URL('/vite.svg', window.location.origin).toString(),
    })
  }, [amberSigner])

  // Handle Amber connection
  useEffect(() => {
    if (!amberSigner) return

    let cleanup = false

    // Start listening for the signer to connect
    const connectSigner = async () => {
      try {
        console.log('Waiting for Amber to connect...')
        setIsAmberConnecting(true)
        await amberSigner.waitForSigner()

        if (cleanup) return

        console.log('Amber connected, getting public key...')
        const pubkey = await amberSigner.getPublicKey()
        console.log('Got public key:', pubkey)

        const account = new NostrConnectAccount(pubkey, amberSigner)

        // Fetch profile data
        const profile = await fetchProfile(pubkey)
        if (profile) {
          account.metadata = {
            ...profile,
            display_name: profile.display_name,
            name: profile.name,
            picture: profile.picture,
            about: profile.about,
            nip05: profile.nip05,
            _isAmber: true  // Mark this as an Amber connection
          }
        } else {
          account.metadata = {
            _isAmber: true  // Mark this as an Amber connection
          }
        }

        manager.addAccount(account)

        toast({
          title: 'Amber connected',
          description: 'Successfully connected to Amber signer',
          status: 'success',
          duration: 3000,
        })

        setShowAmberModal(false)
        setAmberSigner(null)
        setIsAmberConnecting(false)
      } catch (error) {
        console.error('Amber connection error:', error)
        setIsAmberConnecting(false)
        if (!cleanup) {
          toast({
            title: 'Connection failed',
            description: 'Failed to connect to Amber. Please try again.',
            status: 'error',
            duration: 5000,
          })
        }
      }
    }

    connectSigner()

    return () => {
      cleanup = true
      // Clean up if modal is closed without connection
      if (amberSigner && !amberSigner.isConnected) {
        amberSigner.close()
      }
    }
  }, [amberSigner, manager, toast])

  // Bunker connect
  const handleBunkerConnect = async () => {
    setIsConnectingBunker(true)

    try {
      const signer = await NostrConnectSigner.fromBunkerURI(bunkerUri, {
        permissions: NostrConnectSigner.buildSigningPermissions([0, 1, 3, 4, 30473]),
      })

      const pubkey = await signer.getPublicKey()

      const existingBunker = manager.accounts.find((a) => a.type === NostrConnectAccount.type && a.pubkey === pubkey)

      if (existingBunker) {
        toast({
          title: 'Already connected',
          description: 'This bunker account is already connected',
          status: 'info',
          duration: 3000,
        })
        setBunkerUri('')
        onClose()
        return
      }

      const account = new NostrConnectAccount(pubkey, signer)

      // Fetch profile data
      const profile = await fetchProfile(pubkey)
      if (profile) {
        account.metadata = {
          ...profile,
          display_name: profile.display_name,
          name: profile.name,
          picture: profile.picture,
          about: profile.about,
          nip05: profile.nip05
        }
      } else {
        account.metadata = {}
      }

      manager.addAccount(account)

      toast({
        title: 'Bunker connected',
        description: 'Successfully connected to remote signer',
        status: 'success',
        duration: 3000,
      })

      setBunkerUri('')
      onClose()
    } catch (error) {
      console.error('Bunker connect error:', error)
      toast({
        title: 'Connection failed',
        description: error instanceof Error ? error.message : 'Failed to connect to bunker',
        status: 'error',
        duration: 5000,
      })
    } finally {
      setIsConnectingBunker(false)
    }
  }

  // Generate temporary keys
  const handleGenerateTemporaryKeys = async () => {
    try {
      const { secretKey } = generateNostrKeyPair()
      const signer = new SimpleSigner(secretKey)
      const pubkey = await signer.getPublicKey()

      const account = new SimpleAccount(pubkey, signer)
      // Store secret key in account metadata for private key copy functionality
      account.metadata = { _secretKey: secretKey }

      manager.addAccount(account)

      // Set the custom name if provided
      if (nameInput) {
        setCustomName(pubkey, nameInput)
      }

      toast({
        title: 'Temporary account created',
        description: 'Temporary account created (will be lost on logout)',
        status: 'success',
        duration: 3000,
      })

      setNameInput('')
      onClose()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate temporary account',
        status: 'error',
        duration: 3000,
      })
    }
  }


  // Delete account
  const handleDeleteAccount = (account: any) => {
    manager.removeAccount(account)
    toast({
      title: 'Identity removed',
      description: 'Identity has been deleted',
      status: 'info',
      duration: 3000,
    })
  }



  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <HStack spacing={2}>
          <Text fontSize="lg" fontWeight="bold" color="gray.800">Identities</Text>
          <Text fontSize="sm" color="gray.600">({accountsList.length})</Text>
        </HStack>
        <HStack spacing={2}>
          <Tooltip label="Add Identity" placement="bottom">
            <IconButton
              aria-label="Add Identity"
              icon={<span style={{ fontSize: '2rem' }}>+</span>}
              size="sm"
              colorScheme="blue"
              onClick={onOpen}
            />
          </Tooltip>
          <Tooltip label="About Identities" placement="bottom">
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

      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th py={1} px={2}>Profile</Th>
            <Th py={1} px={2}>Key</Th>
            <Th py={1} px={2}>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {accountsList.map((account) => (
            <IdentityRow
              key={account.pubkey}
              account={account}
              onDelete={handleDeleteAccount}
              customName={customNames[account.pubkey]}
              onUpdateCustomName={setCustomName}
            />
          ))}
        </Tbody>
      </Table>

      {/* Add Identity Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Identity</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              {/* Extension Login */}
              {window.nostr && (
                <Button
                  onClick={handleWebExtensionLogin}
                  colorScheme="orange"
                  leftIcon={<span>🔐</span>}
                  w="full"
                >
                  Sign in with Extension
                </Button>
              )}

              {/* Amber Login (Android only) */}
              {IS_WEB_ANDROID && (
                <ButtonGroup colorScheme="yellow" w="full">
                  <Button
                    onClick={handleAmberLogin}
                    leftIcon={<span>💎</span>}
                    flex={1}
                  >
                    Use Amber
                  </Button>
                  <IconButton
                    as={Link}
                    aria-label="What is Amber?"
                    title="What is Amber?"
                    isExternal
                    href="https://github.com/greenart7c3/Amber"
                    icon={<span>❓</span>}
                  />
                </ButtonGroup>
              )}

              <Divider />

              {/* Generate Temporary Keys */}
              <VStack spacing={2}>
                <Text fontSize="sm" fontWeight="bold" color="gray.700">
                  Temporary Keys
                </Text>
                <Input
                  placeholder="Account name (optional)"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
                <Button onClick={handleGenerateTemporaryKeys} colorScheme="gray" variant="outline" w="full">
                  Generate Temporary Keys
                </Button>
                <Text fontSize="xs" color="gray.500" textAlign="center">
                  Keys stored locally. Will be lost when you clear browser data.
                </Text>
              </VStack>

              <Text fontSize="sm" color="gray.600" textAlign="center">
                — OR —
              </Text>

              {/* Bunker Connect */}
              <VStack spacing={2}>
                <Input
                  placeholder="Paste bunker:// URI for remote signer"
                  value={bunkerUri}
                  onChange={(e) => setBunkerUri(e.target.value)}
                  fontFamily="mono"
                  fontSize="sm"
                />
                <Button
                  variant="outline"
                  onClick={handleBunkerConnect}
                  isLoading={isConnectingBunker}
                  loadingText="Connecting to bunker..."
                  colorScheme="teal"
                  isDisabled={!bunkerUri.startsWith('bunker://')}
                  w="full"
                >
                  🔒 Connect Remote Signer (NIP-46)
                </Button>
              </VStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Amber Connection Modal */}
      <Modal isOpen={showAmberModal} onClose={() => {
        setShowAmberModal(false)
        if (amberSigner && !amberSigner.isConnected) {
          amberSigner.close()
        }
        setAmberSigner(null)
      }} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Connect with Amber</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text fontSize="sm" color="gray.600">
                Click the link below or scan the QR code with Amber
              </Text>

              {/* Connection URI as clickable link */}
              <Box>
                <Link
                  href={amberConnectionURI}
                  color="blue.500"
                  fontSize="sm"
                  wordBreak="break-all"
                  display="block"
                  p={3}
                  border="1px solid"
                  borderColor="gray.200"
                  borderRadius="md"
                  _hover={{ bg: 'gray.50' }}
                >
                  Click here to open Amber
                </Link>
              </Box>

              {/* QR Code placeholder */}
              <Box
                p={4}
                border="1px solid"
                borderColor="gray.200"
                borderRadius="md"
                textAlign="center"
              >
                <Text fontSize="xs" color="gray.500">
                  QR Code (install QR library to display)
                </Text>
                <Text fontSize="xs" color="gray.400" mt={2}>
                  {amberConnectionURI.slice(0, 50)}...
                </Text>
              </Box>

              <HStack fontSize="xs" color="gray.500" justify="center" spacing={2}>
                {isAmberConnecting && <Spinner size="sm" />}
                <Text>
                  {isAmberConnecting ? 'Connecting...' : 'Waiting for connection...'}
                </Text>
              </HStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Help Modal */}
      <Modal isOpen={isHelpOpen} onClose={onHelpClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>About Identities</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text>
                Identities are your Nostr accounts that you use to sign location sharing events.
                Spotstr supports multiple identity types:
              </Text>

              <VStack align="stretch" spacing={2}>
                <HStack>
                  <Badge colorScheme="green">Temporary</Badge>
                  <Text fontSize="sm">Keys stored locally in browser (deleted on clear)</Text>
                </HStack>

                <HStack>
                  <Badge colorScheme="orange">Extension</Badge>
                  <Text fontSize="sm">Browser extensions like Alby, nos2x, or Flamingo</Text>
                </HStack>

                <HStack>
                  <Badge colorScheme="yellow">Amber</Badge>
                  <Text fontSize="sm">Android app for secure key management (NIP-46)</Text>
                </HStack>

                <HStack>
                  <Badge colorScheme="teal">Bunker</Badge>
                  <Text fontSize="sm">Remote signing service like nsec.app (NIP-46)</Text>
                </HStack>
              </VStack>

              <Text fontSize="sm" color="gray.600">
                <strong>Tip:</strong> Temporary identities offer maximum privacy - keys stay local
                and are deleted when you clear browser data. Both Amber and Bunker use the
                Nostr Connect protocol (NIP-46) for secure remote signing.
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