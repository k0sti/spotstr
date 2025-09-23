import { Box, Text, VStack } from '@chakra-ui/react'

export function ContactsPage() {
  return (
    <Box>
      <Text fontSize="lg" fontWeight="bold" mb={4} color="gray.800">
        Contacts
      </Text>
      <VStack spacing={4} align="stretch">
        <Text fontSize="sm" color="gray.600">
          Contacts functionality will be implemented later.
        </Text>
      </VStack>
    </Box>
  )
}