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
  Input,
  Select,
  Text,
  useDisclosure
} from '@chakra-ui/react'

export function LocationsPage() {
  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <Box>
      <Box mb={4}>
        <Button onClick={onOpen} size="sm">Create New +</Button>
      </Box>

      <Table size="sm">
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Event ID</Th>
            <Th>Created At</Th>
            <Th>Sender</Th>
            <Th>Receiver</Th>
          </Tr>
        </Thead>
        <Tbody>
          {/* Empty table for now */}
        </Tbody>
      </Table>

      {/* Create Location Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create Location</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <Input placeholder="Geohash" aria-label="Geohash" />
              <Button size="sm">Query Device Location</Button>
              <Text fontSize="sm">Continuous update</Text>
              <Select placeholder="Select Sender" aria-label="Sender">
                <option>Identity 1</option>
              </Select>
              <Select placeholder="Select Receiver" aria-label="Receiver">
                <option>Contact 1</option>
              </Select>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}