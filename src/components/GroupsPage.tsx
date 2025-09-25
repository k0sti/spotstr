import { Box, Text, VStack, HStack, Badge, Button, Divider } from '@chakra-ui/react'

export function GroupsPage() {
  // Dummy data for groups
  const dummyGroups = [
    { id: 1, name: 'Family', members: 5, color: 'green' },
    { id: 2, name: 'Work Team', members: 12, color: 'blue' },
    { id: 3, name: 'Friends', members: 8, color: 'purple' },
    { id: 4, name: 'Hiking Club', members: 15, color: 'orange' },
  ]

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Text fontSize="lg" fontWeight="bold" color="gray.800">Groups</Text>
        <Button size="sm" colorScheme="blue">Create Group +</Button>
      </HStack>

      <VStack spacing={3} align="stretch">
        {dummyGroups.map((group) => (
          <Box
            key={group.id}
            p={3}
            bg="white"
            borderRadius="md"
            border="1px"
            borderColor="gray.200"
            _hover={{ bg: 'gray.50', cursor: 'pointer' }}
          >
            <HStack justify="space-between">
              <HStack spacing={3}>
                <Box>
                  <Text fontWeight="medium">{group.name}</Text>
                  <Text fontSize="xs" color="gray.600">
                    {group.members} members
                  </Text>
                </Box>
              </HStack>
              <Badge colorScheme={group.color} size="sm">
                Active
              </Badge>
            </HStack>
          </Box>
        ))}
      </VStack>

      <Divider my={6} />

      <Box p={4} bg="gray.50" borderRadius="md">
        <Text fontSize="sm" fontWeight="bold" mb={2}>About Groups</Text>
        <Text fontSize="xs" color="gray.600">
          Groups allow you to share your location with multiple contacts at once.
          Create groups for different contexts like family, work, or activities.
        </Text>
      </Box>
    </Box>
  )
}