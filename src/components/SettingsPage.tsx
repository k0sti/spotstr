import { useState, useEffect } from 'react'
import { Box, Text, Input, VStack, FormLabel, Button, HStack, useToast } from '@chakra-ui/react'
import { useNostr } from '../hooks/useNostr'

const DEFAULT_RELAY = 'https://precision.bilberry-tetra.ts.net/relay'

export function SettingsPage() {
  const { connectToRelay } = useNostr()
  const toast = useToast()
  const [relayUrl, setRelayUrl] = useState(DEFAULT_RELAY)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Load saved relay URL from localStorage
    const saved = localStorage.getItem('spotstr_relayUrl')
    if (saved) {
      setRelayUrl(saved)
    }
  }, [])

  const handleConnect = async () => {
    if (!relayUrl) {
      toast({
        title: 'Relay URL required',
        description: 'Please enter a relay URL',
        status: 'warning',
        duration: 3000,
      })
      return
    }

    setIsConnecting(true)
    try {
      await connectToRelay(relayUrl)
      localStorage.setItem('spotstr_relayUrl', relayUrl)
      setIsConnected(true)
      toast({
        title: 'Connected',
        description: `Successfully connected to ${relayUrl}`,
        status: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: 'Failed to connect to relay',
        status: 'error',
        duration: 3000,
      })
      setIsConnected(false)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = () => {
    setIsConnected(false)
    toast({
      title: 'Disconnected',
      description: 'Disconnected from relay',
      status: 'info',
      duration: 2000,
    })
  }

  const resetToDefault = () => {
    setRelayUrl(DEFAULT_RELAY)
    localStorage.setItem('spotstr_relayUrl', DEFAULT_RELAY)
    toast({
      title: 'Reset to default',
      description: 'Relay URL has been reset to default',
      status: 'info',
      duration: 2000,
    })
  }

  return (
    <Box>
      <Text fontSize="lg" fontWeight="bold" mb={4} color="gray.800">Settings</Text>
      <VStack spacing={4} align="stretch">
        <Box>
          <FormLabel>Location Relay</FormLabel>
          <Input 
            value={relayUrl}
            onChange={(e) => setRelayUrl(e.target.value)}
            placeholder="Relay URL"
            disabled={isConnected}
          />
        </Box>
        
        <HStack spacing={2}>
          {!isConnected ? (
            <Button 
              colorScheme="green" 
              size="sm"
              onClick={handleConnect}
              isLoading={isConnecting}
              loadingText="Connecting..."
            >
              Connect
            </Button>
          ) : (
            <Button 
              colorScheme="red" 
              size="sm"
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          )}
          
          <Button 
            size="sm"
            variant="outline"
            onClick={resetToDefault}
            disabled={isConnected}
          >
            Reset to Default
          </Button>
        </HStack>

        {isConnected && (
          <Box p={3} bg="green.50" borderRadius="md">
            <HStack>
              <Text fontSize="sm" color="green.800">
                ✅ Connected to relay
              </Text>
            </HStack>
          </Box>
        )}

        <Box mt={6} p={4} bg="gray.50" borderRadius="md">
          <Text fontSize="sm" fontWeight="bold" mb={2}>About Spotstr</Text>
          <Text fontSize="xs" color="gray.600">
            Spotstr is a location-sharing application built on the Nostr protocol, 
            implementing NIP-30473 for encrypted location events. Share your location 
            privately with selected contacts using geohash encoding.
          </Text>
        </Box>
      </VStack>
    </Box>
  )
}