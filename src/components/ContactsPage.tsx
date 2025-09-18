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
  Text,
  Input,
  useDisclosure,
  useToast,
  IconButton,
  Badge,
  Tooltip
} from '@chakra-ui/react'
import { useNostr } from '../hooks/useNostr'
import { generateNostrKeyPair, validateNpub } from '../utils/crypto'
import { Contact } from '../types'

export function ContactsPage() {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { contacts, addContact, removeContact } = useNostr()
  const toast = useToast()
  const [nameInput, setNameInput] = useState('')
  const [npubInput, setNpubInput] = useState('')
  const [activeTab, setActiveTab] = useState<'generate' | 'paste'>('generate')

  const handleGenerateKey = () => {
    const keyPair = generateNostrKeyPair()
    const contact: Contact = {
      id: crypto.randomUUID(),
      name: nameInput || 'Generated Contact',
      source: 'generated',
      npub: keyPair.npub,
      created_at: Math.floor(Date.now() / 1000),
      profile: { name: nameInput || 'Generated Contact' }
    }

    addContact(contact)
    toast({
      title: 'Contact created',
      description: 'New contact with generated key has been added',
      status: 'success',
      duration: 3000,
    })

    // Reset form
    setNameInput('')
    setNpubInput('')
    onClose()
  }

  const handlePasteNpub = () => {
    if (!validateNpub(npubInput)) {
      toast({
        title: 'Invalid npub',
        description: 'Please enter a valid npub key',
        status: 'error',
        duration: 3000,
      })
      return
    }

    const contact: Contact = {
      id: crypto.randomUUID(),
      name: nameInput || 'Pasted Contact',
      source: 'pasted',
      npub: npubInput,
      created_at: Math.floor(Date.now() / 1000),
      profile: { name: nameInput || 'Pasted Contact' }
    }

    addContact(contact)
    toast({
      title: 'Contact added',
      description: 'Contact has been imported successfully',
      status: 'success',
      duration: 3000,
    })

    // Reset form
    setNameInput('')
    setNpubInput('')
    onClose()
  }

  const handleDeleteContact = (id: string, name: string) => {
    removeContact(id)
    toast({
      title: 'Contact removed',
      description: `${name || 'Unnamed'} contact has been deleted`,
      status: 'info',
      duration: 3000,
    })
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: 'npub copied',
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
        <Text fontSize="lg" fontWeight="bold" color="gray.800">Contacts</Text>
        <Button onClick={onOpen} size="sm" colorScheme="blue">Add Contact +</Button>
      </HStack>

      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Source</Th>
            <Th>Npub</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {contacts.map((contact) => (
            <Tr key={contact.id}>
              <Td>{contact.name || 'Unnamed'}</Td>
              <Td>
                <Badge colorScheme={
                  contact.source === 'generated' ? 'green' : 'blue'
                }>
                  {contact.source}
                </Badge>
              </Td>
              <Td>
                <HStack spacing={1}>
                  <Text fontSize="xs" fontFamily="mono">
                    {contact.npub.slice(0, 8)}...
                  </Text>
                  <Tooltip label="Copy npub">
                    <IconButton
                      size="xs"
                      aria-label="Copy npub"
                      icon={<span>📋</span>}
                      onClick={() => copyToClipboard(contact.npub)}
                    />
                  </Tooltip>
                </HStack>
              </Td>
              <Td>
                <IconButton
                  size="xs"
                  aria-label="Delete contact"
                  icon={<span>🗑️</span>}
                  colorScheme="red"
                  variant="ghost"
                  onClick={() => handleDeleteContact(contact.id, contact.name)}
                />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {/* Add Contact Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Contact</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <Input
                placeholder="Contact Name (optional)"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />

              <HStack spacing={2}>
                <Button
                  size="sm"
                  variant={activeTab === 'generate' ? 'solid' : 'outline'}
                  onClick={() => setActiveTab('generate')}
                  colorScheme="blue"
                >
                  Generate New
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === 'paste' ? 'solid' : 'outline'}
                  onClick={() => setActiveTab('paste')}
                  colorScheme="blue"
                >
                  Paste npub
                </Button>
              </HStack>

              {activeTab === 'generate' ? (
                <VStack spacing={4}>
                  <Text fontSize="sm" color="gray.600">
                    Generate a new ephemeral key for this contact
                  </Text>
                  <Button colorScheme="green" onClick={handleGenerateKey}>
                    Generate New Key
                  </Button>
                </VStack>
              ) : (
                <VStack spacing={4}>
                  <Input
                    placeholder="Paste npub1..."
                    value={npubInput}
                    onChange={(e) => setNpubInput(e.target.value)}
                    fontFamily="mono"
                    fontSize="sm"
                  />
                  <Button 
                    colorScheme="blue" 
                    onClick={handlePasteNpub}
                    disabled={!npubInput}
                  >
                    Add Contact
                  </Button>
                </VStack>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}