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
  VStack,
  HStack,
  Input,
  Text,
  useDisclosure,
  IconButton,
  useToast,
  Badge,
  Tooltip,
  ButtonGroup,
  Link,
  Divider,
  Spinner,
  Editable,
  EditableInput,
  EditablePreview,
  Avatar
} from '@chakra-ui/react'
import { useAccountManager, useAccounts } from 'applesauce-react/hooks'
import { ExtensionAccount, SimpleAccount, NostrConnectAccount } from 'applesauce-accounts/accounts'
import { ExtensionSigner, SimpleSigner, NostrConnectSigner } from 'applesauce-signers'
import { npubEncode } from 'nostr-tools/nip19'
import { generateNostrKeyPair } from '../utils/crypto'
import { fetchProfile } from '../utils/profileRelays'
import { useAccountCustomNames } from '../hooks/useAccountCustomNames'

// Check if we're on Android
const IS_WEB_ANDROID = /android/i.test(navigator.userAgent)

// Helper functions
const getAccountTypeBadgeColor = (type: string) => {
  switch (type) {
    case 'simple': return 'green'
    case 'extension': return 'orange'
    case 'amber-clipboard': return 'yellow'
    case 'nostr-connect': return 'teal'
    default: return 'gray'
  }
}

const getAccountTypeLabel = (type: string) => {
  switch (type) {
    case 'simple': return 'Local'
    case 'extension': return 'Extension'
    case 'amber-clipboard': return 'Amber'
    case 'nostr-connect': return 'Bunker'
    default: return type
  }
}

// Identity Row Component
function IdentityRow({ account, onDelete, onCopy, customName, onUpdateCustomName }: {
  account: any
  onDelete: (account: any) => void
  onCopy: (text: string, label: string) => void
  customName?: string
  onUpdateCustomName: (pubkey: string, name: string) => void
}) {
  const npubFull = useMemo(() => {
    try {
      return npubEncode(account.pubkey)
    } catch {
      return account.pubkey
    }
  }, [account.pubkey])

  const npubShort = useMemo(() => {
    if (npubFull.startsWith('npub')) {
      const withoutPrefix = npubFull.slice(4)
      return `${withoutPrefix.slice(0, 5)}..${withoutPrefix.slice(-5)}`
    }
    return account.pubkey.slice(0, 8) + '...'
  }, [npubFull])

  return (
    <Tr>
      <Td>
        <Badge colorScheme={getAccountTypeBadgeColor(account.type)}>
          {getAccountTypeLabel(account.type)}
        </Badge>
      </Td>
      <Td>
        <HStack spacing={3}>
          <Avatar
            size="sm"
            src={account.metadata?.picture}
            name={account.metadata?.name || customName || 'Unknown'}
          />
          <VStack align="start" spacing={0}>
            {account.metadata?.name && (
              <Text fontSize="sm" fontWeight="medium">
                {account.metadata.name}
              </Text>
            )}
            <Editable
              defaultValue={customName || ''}
              placeholder={account.metadata?.name ? 'Add custom name' : 'Custom name'}
              onSubmit={(value) => onUpdateCustomName(account.pubkey, value)}
              fontSize="xs"
              color="blue.600"
              fontStyle="italic"
            >
              <EditablePreview />
              <EditableInput />
            </Editable>
          </VStack>
        </HStack>
      </Td>
      <Td>
        <VStack align="start" spacing={0}>
          <HStack spacing={1}>
            <Text fontSize="xs" color="gray.600">npub</Text>
            <Tooltip label="Copy npub">
              <IconButton
                size="xs"
                aria-label="Copy npub"
                icon={<span>📋</span>}
                variant="ghost"
                onClick={() => onCopy(npubFull, 'Public key')}
              />
            </Tooltip>
          </HStack>
          <Text fontSize="xs" fontFamily="mono" color="gray.700">
            {npubShort}
          </Text>
        </VStack>
      </Td>
      <Td>
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
            nip05: profile.nip05
          }
        } else {
          account.metadata = {}
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

  // Generate ephemeral keys (temporary)
  const handleGenerateEphemeralKeys = async () => {
    try {
      const { secretKey } = generateNostrKeyPair()
      const signer = new SimpleSigner(secretKey)
      const pubkey = await signer.getPublicKey()

      const account = new SimpleAccount(pubkey, signer)
      account.metadata = {}

      manager.addAccount(account)

      // Set the custom name if provided
      if (nameInput) {
        setCustomName(pubkey, nameInput)
      }

      toast({
        title: 'Ephemeral account created',
        description: 'Temporary account created (will be lost on logout)',
        status: 'success',
        duration: 3000,
      })

      setNameInput('')
      onClose()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate ephemeral account',
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

  // Copy to clipboard
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: `${type} copied`,
        status: 'success',
        duration: 2000,
      })
    } catch (error) {
      toast({
        title: 'Copy failed',
        status: 'error',
        duration: 2000,
      })
    }
  }


  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Text fontSize="lg" fontWeight="bold" color="gray.800">Identities</Text>
        <Button onClick={onOpen} size="sm" colorScheme="blue">Add Identity +</Button>
      </HStack>

      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th>Type</Th>
            <Th>Identity</Th>
            <Th>Public Key</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {accountsList.map((account) => (
            <IdentityRow
              key={account.pubkey}
              account={account}
              onDelete={handleDeleteAccount}
              onCopy={copyToClipboard}
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

              {/* Generate Ephemeral Keys */}
              <VStack spacing={2}>
                <Text fontSize="sm" fontWeight="bold" color="gray.700">
                  Ephemeral Keys (Temporary)
                </Text>
                <Input
                  placeholder="Account name (optional)"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
                <Button onClick={handleGenerateEphemeralKeys} colorScheme="gray" variant="outline" w="full">
                  Generate Ephemeral Keys
                </Button>
                <Text fontSize="xs" color="gray.500" textAlign="center">
                  For temporary use only. Will be lost when you clear browser data.
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
    </Box>
  )
}