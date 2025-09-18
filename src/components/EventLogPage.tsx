import { Box, Text, Button, VStack } from '@chakra-ui/react'

export function EventLogPage() {
  return (
    <Box>
      <Text fontSize="lg" fontWeight="bold" mb={4} color="gray.800">Event Log</Text>
      <Button size="sm" mb={4}>Clear Log</Button>
      <VStack spacing={2} align="stretch">
        {/* Empty event list for now */}
        <Text fontSize="sm" color="gray.500">No events yet</Text>
      </VStack>
    </Box>
  )
}