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
  VStack,
  Input,
  Text,
  useDisclosure,
  IconButton,
  useToast,
  Badge,
  HStack,
  Tooltip
} from '@chakra-ui/react'
import { useNostr } from '../hooks/useNostr'
import { generateNostrKeyPair, validateNsec, validateNpub, deriveNpubFromNsec } from '../utils/crypto'
import { Identity } from '../types'
import { NostrConnectSigner } from 'applesauce-signers'

export function IdentitiesPage() {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { identities, addIdentity, removeIdentity } = useNostr()
  const toast = useToast()
  const [keyInput, setKeyInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [isCheckingExtension, setIsCheckingExtension] = useState(false)
  const [isCheckingAmber, setIsCheckingAmber] = useState(false)
  const [bunkerUri, setBunkerUri] = useState('')
  const [isConnectingBunker, setIsConnectingBunker] = useState(false)

  const handleBunkerConnect = async () => {
    setIsConnectingBunker(true)

    try {
      // Import necessary dependencies
      const { Relay } = await import('applesauce-relay')

      // Set up subscription and publish methods for NostrConnect
      NostrConnectSigner.subscriptionMethod = (relays: string[], filters: any[]) => {
        // Create a simple observable for the subscription
        const { Observable } = require('rxjs')
        return new Observable((observer: any) => {
          const relay = new Relay(relays[0])
          const sub = relay.req(filters).subscribe({
            next: (event: any) => {
              if (event !== 'EOSE') {
                observer.next(event)
              }
            },
            error: (err: any) => observer.error(err),
            complete: () => observer.complete(),
          })
          return () => {
            sub.unsubscribe()
            relay.close()
          }
        })
      }

      NostrConnectSigner.publishMethod = async (relays: string[], event: any) => {
        for (const relayUrl of relays) {
          const relay = new Relay(relayUrl)
          await relay.publish(event)
          relay.close()
        }
      }

      // Parse and connect to the bunker URI
      const signer = await NostrConnectSigner.fromBunkerURI(bunkerUri, {
        permissions: NostrConnectSigner.buildSigningPermissions([0, 1, 3, 4, 30473]),
      })

      // Get the public key from the bunker
      const pubkey = await signer.getPublicKey()
      const { npubEncode } = await import('nostr-tools/nip19')
      const npub = npubEncode(pubkey)

      // Check if this identity already exists
      const existingIdentity = identities.find(id => id.npub === npub)
      if (existingIdentity) {
        toast({
          title: 'Identity already exists',
          description: 'This bunker identity is already in your list',
          status: 'info',
          duration: 3000,
        })
        return
      }

      // Create identity for bunker signer
      const identity: Identity = {
        id: crypto.randomUUID(),
        name: nameInput || 'Bunker Identity',
        source: 'bunker',
        npub: npub,
        nsec: undefined, // No nsec for bunker identities
        bunkerUri: bunkerUri, // Store the bunker URI for reconnection
        created_at: Math.floor(Date.now() / 1000),
      }

      // Store the signer in our global signers map
      if (!window.nostrSigners) {
        window.nostrSigners = new Map()
      }
      window.nostrSigners.set(identity.id, signer)

      addIdentity(identity)
      toast({
        title: 'Bunker connected',
        description: 'Successfully connected to remote signer',
        status: 'success',
        duration: 3000,
      })

      setNameInput('')
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

  const handleAmberLogin = async () => {
    setIsCheckingAmber(true)

    try {
      // Check if we're on Android
      const isAndroid = /android/i.test(navigator.userAgent)

      if (!isAndroid) {
        toast({
          title: 'Android only',
          description: 'Amber signer is only available on Android devices',
          status: 'info',
          duration: 4000,
        })
        return
      }

      // Create intent URL to get public key from Amber
      const intentUrl = `nostrsigner:?compressionType=none&returnType=signature&type=get_public_key`

      // For web apps, we need to open Amber and wait for clipboard response
      toast({
        title: 'Opening Amber',
        description: 'Please approve the request in Amber and return to this app',
        status: 'info',
        duration: 5000,
      })

      // Store the current clipboard content to detect changes
      const originalClipboard = await navigator.clipboard.readText().catch(() => '')

      // Open Amber
      window.location.href = intentUrl

      // Wait for user to return (they need to manually come back)
      // We'll handle the response when the page regains focus
      const checkClipboard = async () => {
        const newClipboard = await navigator.clipboard.readText().catch(() => '')

        if (newClipboard && newClipboard !== originalClipboard && newClipboard.startsWith('npub')) {
          // Successfully got npub from Amber
          const npub = newClipboard

          // Check if this identity already exists
          const existingIdentity = identities.find(id => id.npub === npub)
          if (existingIdentity) {
            toast({
              title: 'Identity already exists',
              description: 'This Amber identity is already in your list',
              status: 'info',
              duration: 3000,
            })
            return
          }

          // Create identity for Amber signer
          const identity: Identity = {
            id: crypto.randomUUID(),
            name: nameInput || 'Amber Identity',
            source: 'amber',
            npub: npub,
            nsec: undefined, // No nsec for Amber identities
            created_at: Math.floor(Date.now() / 1000),
          }

          addIdentity(identity)
          toast({
            title: 'Amber connected',
            description: 'Successfully connected to Amber signer',
            status: 'success',
            duration: 3000,
          })

          setNameInput('')
          onClose()
        }
      }

      // Set up a listener for when the page regains focus
      const handleFocus = () => {
        setTimeout(checkClipboard, 500) // Small delay to ensure clipboard is updated
      }

      window.addEventListener('focus', handleFocus, { once: true })

      // Also try checking after a timeout in case focus doesn't trigger
      setTimeout(() => {
        checkClipboard()
        window.removeEventListener('focus', handleFocus)
      }, 10000)

    } catch (error) {
      console.error('Amber login error:', error)
      toast({
        title: 'Amber error',
        description: error instanceof Error ? error.message : 'Failed to connect to Amber',
        status: 'error',
        duration: 5000,
      })
    } finally {
      setIsCheckingAmber(false)
    }
  }

  const handleWebExtensionLogin = async () => {
    setIsCheckingExtension(true)

    try {
      // Check if window.nostr is available
      if (!window.nostr) {
        toast({
          title: 'Extension not found',
          description: 'Please install a Nostr browser extension like Alby, nos2x, or Flamingo',
          status: 'warning',
          duration: 5000,
        })
        return
      }

      // Get public key from extension
      const pubkey = await window.nostr.getPublicKey()

      // Convert hex pubkey to npub
      const { npubEncode } = await import('nostr-tools/nip19')
      const npub = npubEncode(pubkey)

      // Check if this identity already exists
      const existingIdentity = identities.find(id => id.npub === npub)
      if (existingIdentity) {
        toast({
          title: 'Identity already exists',
          description: 'This extension identity is already in your list',
          status: 'info',
          duration: 3000,
        })
        return
      }

      // Create identity without nsec (will use extension for signing)
      const identity: Identity = {
        id: crypto.randomUUID(),
        name: nameInput || 'Extension Identity',
        source: 'extension',
        npub: npub,
        nsec: undefined, // No nsec for extension identities
        created_at: Math.floor(Date.now() / 1000),
      }

      addIdentity(identity)
      toast({
        title: 'Extension connected',
        description: 'Successfully connected to browser extension',
        status: 'success',
        duration: 3000,
      })

      setNameInput('')
      onClose()
    } catch (error) {
      console.error('Extension login error:', error)
      toast({
        title: 'Extension error',
        description: error instanceof Error ? error.message : 'Failed to connect to extension',
        status: 'error',
        duration: 5000,
      })
    } finally {
      setIsCheckingExtension(false)
    }
  }

  const handleGenerateKeys = async () => {
    try {
      const keyPair = generateNostrKeyPair()
      const identity: Identity = {
        id: crypto.randomUUID(),
        name: nameInput || 'Generated Identity',
        source: 'created',
        npub: keyPair.npub,
        nsec: keyPair.nsec,
        created_at: Math.floor(Date.now() / 1000),
      }
      
      addIdentity(identity)
      toast({
        title: 'Identity created',
        description: 'New identity generated successfully',
        status: 'success',
        duration: 3000,
      })
      
      setNameInput('')
      onClose()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate identity',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleImportKey = () => {
    const trimmedKey = keyInput.trim()
    
    // Check if it's an nsec
    if (validateNsec(trimmedKey)) {
      // Derive npub from nsec
      const npub = deriveNpubFromNsec(trimmedKey)
      if (!npub) {
        toast({
          title: 'Error',
          description: 'Failed to derive public key from nsec',
          status: 'error',
          duration: 3000,
        })
        return
      }

      const identity: Identity = {
        id: crypto.randomUUID(),
        name: nameInput || 'Imported Identity',
        source: 'nsec',
        npub: npub,
        nsec: trimmedKey,
        created_at: Math.floor(Date.now() / 1000),
      }

      addIdentity(identity)
      toast({
        title: 'Identity imported',
        description: 'Identity imported from nsec successfully',
        status: 'success',
        duration: 3000,
      })
    } 
    // Check if it's an npub
    else if (validateNpub(trimmedKey)) {
      const identity: Identity = {
        id: crypto.randomUUID(),
        name: nameInput || 'Watch-only Identity',
        source: 'npub',
        npub: trimmedKey,
        // No nsec for npub-only imports
        created_at: Math.floor(Date.now() / 1000),
      }

      addIdentity(identity)
      toast({
        title: 'Identity imported',
        description: 'Watch-only identity imported from npub',
        status: 'success',
        duration: 3000,
      })
    } else {
      toast({
        title: 'Invalid key',
        description: 'Please enter a valid nsec or npub key',
        status: 'error',
        duration: 3000,
      })
      return
    }

    setKeyInput('')
    setNameInput('')
    onClose()
  }

  const handleDeleteIdentity = (id: string, name: string) => {
    removeIdentity(id)
    toast({
      title: 'Identity removed',
      description: `${name || 'Unnamed'} identity has been deleted`,
      status: 'info',
      duration: 3000,
    })
  }

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

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'created': return 'green'
      case 'nsec': return 'blue'
      case 'npub': return 'purple'
      case 'extension': return 'orange'
      case 'amber': return 'yellow'
      case 'bunker': return 'teal'
      default: return 'gray'
    }
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Text fontSize="lg" fontWeight="bold" color="gray.800">Identities</Text>
        <Button onClick={onOpen} size="sm" colorScheme="blue">Create New +</Button>
      </HStack>

      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Source</Th>
            <Th>Keys</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {identities.map((identity) => (
            <Tr key={identity.id}>
              <Td>{identity.name || 'Unnamed'}</Td>
              <Td>
                <Badge colorScheme={getSourceBadgeColor(identity.source)}>
                  {identity.source}
                </Badge>
              </Td>
              <Td>
                <HStack spacing={1}>
                  <Text fontSize="xs" fontFamily="mono">
                    {identity.npub.slice(0, 8)}...
                  </Text>
                  <Tooltip label="Copy npub">
                    <IconButton
                      size="xs"
                      aria-label="Copy npub"
                      icon={<span>📋</span>}
                      onClick={() => copyToClipboard(identity.npub, 'npub')}
                    />
                  </Tooltip>
                  {identity.nsec && (
                    <Tooltip label="Copy nsec">
                      <IconButton
                        size="xs"
                        aria-label="Copy nsec"
                        icon={<span>🔑</span>}
                        onClick={() => copyToClipboard(identity.nsec!, 'nsec')}
                      />
                    </Tooltip>
                  )}
                </HStack>
              </Td>
              <Td>
                <IconButton
                  size="xs"
                  aria-label="Delete identity"
                  icon={<span>🗑️</span>}
                  colorScheme="red"
                  variant="ghost"
                  onClick={() => handleDeleteIdentity(identity.id, identity.name || '')}
                />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {/* Create Identity Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create Identity</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <Input
                placeholder="Name (optional)"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
              
              <Button onClick={handleGenerateKeys} colorScheme="green">
                Generate New Keys
              </Button>
              
              <Text fontSize="sm" color="gray.600" textAlign="center">
                — OR —
              </Text>
              
              <VStack spacing={2}>
                <Input 
                  placeholder="Paste npub or nsec" 
                  aria-label="Paste key"
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
                >
                  Import Key
                </Button>
              </VStack>
              
              <Button
                variant="outline"
                onClick={handleWebExtensionLogin}
                isLoading={isCheckingExtension}
                loadingText="Checking extension..."
              >
                🔐 Sign in with Extension
              </Button>

              <Button
                variant="outline"
                onClick={handleAmberLogin}
                isLoading={isCheckingAmber}
                loadingText="Connecting to Amber..."
                colorScheme="orange"
              >
                📱 Connect Amber (Android)
              </Button>

              <Text fontSize="sm" color="gray.600" textAlign="center">
                — OR —
              </Text>

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
                >
                  🔒 Connect Remote Signer (NIP-46)
                </Button>
              </VStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}