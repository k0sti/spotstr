import { Box, Text, Input, VStack, FormLabel } from '@chakra-ui/react'

export function SettingsPage() {
  return (
    <Box>
      <Text fontSize="lg" fontWeight="bold" mb={4}>Settings</Text>
      <VStack spacing={4} align="stretch">
        <Box>
          <FormLabel>Location Relay</FormLabel>
          <Input 
            defaultValue="https://precision.bilberry-tetra.ts.net/relay"
            placeholder="Relay URL"
          />
        </Box>
      </VStack>
    </Box>
  )
}