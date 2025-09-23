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
  Input,
  Text,
  useDisclosure,
  IconButton,
  useToast,
  Badge,
  HStack,
  Tooltip,
  ButtonGroup,
  Link,
  Divider,
  Spinner
} from '@chakra-ui/react'
import { useAccountManager, useAccounts } from 'applesauce-react/hooks'
import { ExtensionAccount, SimpleAccount, NostrConnectAccount } from 'applesauce-accounts/accounts'
import { ExtensionSigner, SimpleSigner, NostrConnectSigner } from 'applesauce-signers'
import { npubEncode } from 'nostr-tools/nip19'

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

// Account Row Component
function AccountRow({ account, manager, onDelete, onCopy }: {
  account: any
  manager: any
  onDelete: (account: any) => void
  onCopy: (text: string, label: string) => void
}) {
  const npubDisplay = useMemo(() => {
    try {
      const npub = npubEncode(account.pubkey)
      return npub.slice(0, 12) + '...' + npub.slice(-4)
    } catch {
      // Fallback to showing hex if nip19 not available
      return account.pubkey.slice(0, 8) + '...'
    }
  }, [account.pubkey])

  return (
    <Tr>
      <Td>
        <Badge colorScheme={getAccountTypeBadgeColor(account.type)}>
          {getAccountTypeLabel(account.type)}
        </Badge>
      </Td>
      <Td>
        <HStack spacing={1}>
          <Text fontSize="xs" fontFamily="mono">
            {npubDisplay}
          </Text>
          <Tooltip label="Copy npub">
            <IconButton
              size="xs"
              aria-label="Copy npub"
              icon={<span>📋</span>}
              onClick={() => {
                try {
                  const npub = npubEncode(account.pubkey)
                  onCopy(npub, 'Public key')
                } catch {
                  onCopy(account.pubkey, 'Public key')
                }
              }}
            />
          </Tooltip>
        </HStack>
      </Td>
      <Td>
        {manager.active === account ? (
          <Badge colorScheme="green">Active</Badge>
        ) : (
          <Button
            size="xs"
            onClick={() => manager.setActive(account)}
          >
            Set Active
          </Button>
        )}
      </Td>
      <Td>
        <IconButton
          size="xs"
          aria-label="Delete account"
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
  const toast = useToast()
  const [nameInput, setNameInput] = useState('')
  const [keyInput, setKeyInput] = useState('')
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
      const account =
        manager.accounts.find((a) => a.type === ExtensionAccount.type && a.pubkey === pubkey) ??
        new ExtensionAccount(pubkey, signer)

      if (!manager.accounts.includes(account)) {
        manager.addAccount(account)
      }

      manager.setActive(account)

      toast({
        title: 'Extension connected',
        description: 'Successfully connected to browser extension',
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
        manager.addAccount(account)
        manager.setActive(account)

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

      const account =
        manager.accounts.find((a) => a.type === NostrConnectAccount.type && a.pubkey === pubkey) ??
        new NostrConnectAccount(pubkey, signer)

      if (!manager.accounts.includes(account)) {
        manager.addAccount(account)
      }

      manager.setActive(account)

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

  // Generate new keys
  const handleGenerateKeys = async () => {
    try {
      const signer = new SimpleSigner()
      const pubkey = await signer.getPublicKey()

      const account = new SimpleAccount(pubkey, signer)
      account.metadata = { name: nameInput || 'Generated Account' }

      manager.addAccount(account)
      manager.setActive(account)

      toast({
        title: 'Account created',
        description: 'New account generated successfully',
        status: 'success',
        duration: 3000,
      })

      setNameInput('')
      onClose()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate account',
        status: 'error',
        duration: 3000,
      })
    }
  }

  // Import from nsec
  const handleImportKey = async () => {
    try {
      const trimmedKey = keyInput.trim()

      if (!trimmedKey.startsWith('nsec1')) {
        toast({
          title: 'Invalid key',
          description: 'Please enter a valid nsec key',
          status: 'error',
          duration: 3000,
        })
        return
      }

      const { decode } = await import('nostr-tools/nip19')
      const decoded = decode(trimmedKey)

      if (decoded.type !== 'nsec') {
        throw new Error('Invalid nsec key')
      }

      const signer = new SimpleSigner(decoded.data as Uint8Array)
      const pubkey = await signer.getPublicKey()

      const account = new SimpleAccount(pubkey, signer)
      account.metadata = { name: nameInput || 'Imported Account' }

      manager.addAccount(account)
      manager.setActive(account)

      toast({
        title: 'Account imported',
        description: 'Account imported from nsec successfully',
        status: 'success',
        duration: 3000,
      })

      setKeyInput('')
      setNameInput('')
      onClose()
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import key',
        status: 'error',
        duration: 3000,
      })
    }
  }

  // Delete account
  const handleDeleteAccount = (account: any) => {
    manager.removeAccount(account)
    toast({
      title: 'Account removed',
      description: 'Account has been deleted',
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
        <Text fontSize="lg" fontWeight="bold" color="gray.800">Accounts</Text>
        <Button onClick={onOpen} size="sm" colorScheme="blue">Add Account +</Button>
      </HStack>

      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th>Type</Th>
            <Th>Public Key</Th>
            <Th>Active</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {accountsList.map((account) => (
            <AccountRow
              key={account.pubkey}
              account={account}
              manager={manager}
              onDelete={handleDeleteAccount}
              onCopy={copyToClipboard}
            />
          ))}
        </Tbody>
      </Table>

      {/* Add Account Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Account</ModalHeader>
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

              {/* Generate New Keys */}
              <VStack spacing={2}>
                <Input
                  placeholder="Account name (optional)"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
                <Button onClick={handleGenerateKeys} colorScheme="green" w="full">
                  Generate New Keys
                </Button>
              </VStack>

              <Text fontSize="sm" color="gray.600" textAlign="center">
                — OR —
              </Text>

              {/* Import from nsec */}
              <VStack spacing={2}>
                <Input
                  placeholder="Paste nsec key"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  fontFamily="mono"
                  fontSize="sm"
                />
                <Button
                  onClick={handleImportKey}
                  disabled={!keyInput}
                  size="sm"
                  colorScheme="blue"
                  w="full"
                >
                  Import Key
                </Button>
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