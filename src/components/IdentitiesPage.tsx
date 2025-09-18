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
import { generateNostrKeyPair, validateNsec } from '../utils/crypto'
import { Identity } from '../types'

export function IdentitiesPage() {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { identities, addIdentity } = useNostr()
  const toast = useToast()
  const [nsecInput, setNsecInput] = useState('')
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

  const handlePasteNsec = () => {
    if (!validateNsec(nsecInput)) {
      toast({
        title: 'Invalid nsec',
        description: 'Please enter a valid nsec key',
        status: 'error',
        duration: 3000,
      })
      return
    }

    // Would derive npub from nsec in production
    const identity: Identity = {
      id: crypto.randomUUID(),
      name: nameInput || 'Imported Identity',
      source: 'pasted',
      npub: `npub1${nsecInput.slice(5)}`, // Simplified
      nsec: nsecInput,
      created_at: Math.floor(Date.now() / 1000),
    }

    addIdentity(identity)
    toast({
      title: 'Identity imported',
      description: 'Identity imported successfully',
      status: 'success',
      duration: 3000,
    })

    setNsecInput('')
    setNameInput('')
    onClose()
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

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Text fontSize="lg" fontWeight="bold">Identities</Text>
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
                <Badge colorScheme={
                  identity.source === 'created' ? 'green' :
                  identity.source === 'pasted' ? 'blue' : 'purple'
                }>
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
              
              <VStack spacing={2}>
                <Input 
                  placeholder="Paste existing nsec" 
                  aria-label="Paste nsec"
                  value={nsecInput}
                  onChange={(e) => setNsecInput(e.target.value)}
                />
                <Button 
                  onClick={handlePasteNsec} 
                  disabled={!nsecInput}
                  size="sm"
                >
                  Import nsec
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