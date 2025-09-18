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

export function IdentitiesPage() {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { identities, addIdentity, removeIdentity } = useNostr()
  const toast = useToast()
  const [keyInput, setKeyInput] = useState('')
  const [nameInput, setNameInput] = useState('')

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
              
              <Button variant="outline">Sign in with Extension</Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}