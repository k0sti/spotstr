import { useState, useMemo } from 'react'
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
  Input,
  Avatar,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Textarea,
  Badge
} from '@chakra-ui/react'
import { useContacts } from '../hooks/useContacts'

// Contact Row Component
function ContactRow({
  contact,
  onDelete,
  onCopy,
  onUpdateCustomName
}: {
  contact: any
  onDelete: (contact: any) => void
  onCopy: (text: string, label: string) => void
  onUpdateCustomName: (id: string, name: string) => void
}) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [customNameInput, setCustomNameInput] = useState(contact.customName || '')

  const npubShort = useMemo(() => {
    if (contact.npub.startsWith('npub')) {
      const withoutPrefix = contact.npub.slice(4)
      return `${withoutPrefix.slice(0, 5)}..${withoutPrefix.slice(-5)}`
    }
    return contact.npub.slice(0, 8) + '...'
  }, [contact.npub])

  const displayName = contact.customName || contact.metadata?.display_name || contact.metadata?.name || 'Unknown'

  const handleSaveCustomName = () => {
    onUpdateCustomName(contact.id, customNameInput)
    setIsEditingName(false)
  }

  return (
    <Tr>
      <Td>
        <HStack spacing={3}>
          <Avatar
            size="sm"
            src={contact.metadata?.picture}
            name={displayName}
          />
          <VStack align="start" spacing={0}>
            {contact.metadata?.display_name || contact.metadata?.name ? (
              <Text fontSize="sm" fontWeight="medium">
                {contact.metadata.display_name || contact.metadata.name}
              </Text>
            ) : null}
            {isEditingName ? (
              <HStack spacing={1}>
                <Input
                  size="xs"
                  value={customNameInput}
                  onChange={(e) => setCustomNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCustomName()
                    if (e.key === 'Escape') {
                      setCustomNameInput(contact.customName || '')
                      setIsEditingName(false)
                    }
                  }}
                  placeholder="Custom name"
                  autoFocus
                />
                <IconButton
                  size="xs"
                  aria-label="Save"
                  icon={<span>✓</span>}
                  onClick={handleSaveCustomName}
                  colorScheme="green"
                />
                <IconButton
                  size="xs"
                  aria-label="Cancel"
                  icon={<span>✗</span>}
                  onClick={() => {
                    setCustomNameInput(contact.customName || '')
                    setIsEditingName(false)
                  }}
                  colorScheme="red"
                />
              </HStack>
            ) : (
              <HStack spacing={1}>
                {contact.customName ? (
                  <Text fontSize="xs" color="blue.600" fontStyle="italic">
                    {contact.customName}
                  </Text>
                ) : null}
                <Tooltip label="Edit custom name">
                  <IconButton
                    size="xs"
                    aria-label="Edit name"
                    icon={<span>✏️</span>}
                    variant="ghost"
                    onClick={() => setIsEditingName(true)}
                  />
                </Tooltip>
              </HStack>
            )}
          </VStack>
        </HStack>
      </Td>
      <Td>
        <HStack spacing={1}>
          <Text fontSize="xs" fontFamily="mono" color="gray.700">
            {npubShort}
          </Text>
          <Tooltip label="Copy npub">
            <IconButton
              size="xs"
              aria-label="Copy npub"
              icon={<span>📋</span>}
              variant="ghost"
              onClick={() => onCopy(contact.npub, 'Contact npub')}
            />
          </Tooltip>
        </HStack>
      </Td>
      <Td>
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
  const [npubInput, setNpubInput] = useState('')
  const [importCount, setImportCount] = useState(0)
  const { addMultipleContacts } = useContacts()
  const toast = useToast()

  const handleImport = () => {
    // Split by newlines, commas, or spaces
    const npubList = npubInput
      .split(/[\n,\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)

    if (npubList.length === 0) {
      toast({
        title: 'No contacts to import',
        description: 'Please enter one or more npubs',
        status: 'warning',
        duration: 3000,
      })
      return
    }

    const { added, failed } = addMultipleContacts(npubList)

    if (added.length > 0) {
      setImportCount(prev => prev + added.length)
      setNpubInput('') // Clear the input after successful import

      toast({
        title: 'Contacts imported',
        description: `Added ${added.length} contact(s)`,
        status: 'success',
        duration: 3000,
      })
    }

    if (failed.length > 0) {
      toast({
        title: 'Some contacts failed',
        description: `${failed.length} contact(s) were invalid or already exist`,
        status: 'warning',
        duration: 3000,
      })
    }
  }

  const handleClose = () => {
    setNpubInput('')
    setImportCount(0)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add Contacts</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Text fontSize="sm" color="gray.600">
              Paste npubs below (one per line or separated by commas/spaces)
            </Text>
            <Textarea
              placeholder="npub1..."
              value={npubInput}
              onChange={(e) => setNpubInput(e.target.value)}
              rows={8}
              fontFamily="mono"
              fontSize="sm"
            />
            <HStack justify="space-between">
              <Button
                size="sm"
                onClick={handleImport}
                colorScheme="blue"
                isDisabled={!npubInput.trim()}
              >
                Import
              </Button>
              {importCount > 0 && (
                <Badge colorScheme="green" fontSize="sm" px={2} py={1}>
                  Imported: {importCount}
                </Badge>
              )}
            </HStack>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={handleClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export function ContactsPage() {
  const { isOpen, onOpen, onClose } = useDisclosure()
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
        <HStack spacing={3}>
          <Text fontSize="lg" fontWeight="bold" color="gray.800">Contacts</Text>
          <Text fontSize="sm" color="gray.600">({contacts.length})</Text>
        </HStack>
        <Button onClick={onOpen} size="sm" colorScheme="blue">Add Contact +</Button>
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
              <Th>Identity</Th>
              <Th>Npub</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {contacts.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                onDelete={handleDeleteContact}
                onCopy={copyToClipboard}
                onUpdateCustomName={updateCustomName}
              />
            ))}
          </Tbody>
        </Table>
      )}

      {/* Add Contact Modal */}
      <AddContactModal isOpen={isOpen} onClose={onClose} />
    </Box>
  )
}