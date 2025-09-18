import { 
  Box, 
  Button, 
  Table, 
  Thead, 
  Tbody, 
  Tr, 
  Th, 
  Modal, 
  ModalOverlay, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalCloseButton,
  VStack,
  Text,
  useDisclosure
} from '@chakra-ui/react'

export function ContactsPage() {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <Box>
      <Box mb={4}>
        <Button onClick={onOpen} size="sm">Add Contact +</Button>
      </Box>

      <Table size="sm">
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Source</Th>
            <Th>Profile</Th>
          </Tr>
        </Thead>
        <Tbody>
          {/* Empty table for now */}
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
              <Button>Generate New Key</Button>
              <Text>Paste npub</Text>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}