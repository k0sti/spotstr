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
  Textarea,
  Badge
} from '@chakra-ui/react'
import { useContacts } from '../hooks/useContacts'
import { IdentityDisplay } from './shared/IdentityDisplay'
import { KeyDisplay } from './shared/KeyDisplay'

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
      <Td>
        <IdentityDisplay
          pubkey={contact.pubkey}
          metadata={contact.metadata}
          customName={contact.customName}
          onUpdateCustomName={(name) => onUpdateCustomName(contact.id, name)}
        />
      </Td>
      <Td>
        <KeyDisplay pubkey={contact.pubkey} showPrivateKey={false} />
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

  const handleImport = async () => {
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

    const { added, failed } = await addMultipleContacts(npubList)

    if (added.length > 0) {
      setImportCount(prev => prev + added.length)
      setNpubInput('') // Clear the input after successful import

      toast({
        title: 'Contacts imported',
        description: `Added ${added.length} contact(s). Fetching profiles...`,
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
              <Th>Profile</Th>
              <Th>Key</Th>
              <Th>Actions</Th>
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
    </Box>
  )
}