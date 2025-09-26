import { useState, useEffect } from 'react'
import { Box, Text, Input, VStack, FormLabel, Button, HStack, useToast, Divider, Textarea, Switch, IconButton, Tooltip, useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter, Link } from '@chakra-ui/react'
import { useNostr } from '../hooks/useNostr'

const DEFAULT_RELAY = 'https://precision.bilberry-tetra.ts.net/relay'
const DEFAULT_PROFILE_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band'
]

export function SettingsPage() {
  const { connectToRelay, disconnectRelay, isRelayConnected } = useNostr()
  const { isOpen: isHelpOpen, onOpen: onHelpOpen, onClose: onHelpClose } = useDisclosure()
  const toast = useToast()
  const [relayUrl, setRelayUrl] = useState(DEFAULT_RELAY)
  const [isConnecting, setIsConnecting] = useState(false)
  const [profileRelays, setProfileRelays] = useState<string[]>(DEFAULT_PROFILE_RELAYS)
  const [simulateLocation, setSimulateLocation] = useState(false)

  useEffect(() => {
    // Load saved relay URL from localStorage
    const saved = localStorage.getItem('spotstr_relayUrl')
    if (saved) {
      setRelayUrl(saved)
    }

    // Load saved profile relays
    const savedProfileRelays = localStorage.getItem('spotstr_profileRelays')
    if (savedProfileRelays) {
      try {
        const parsed = JSON.parse(savedProfileRelays)
        if (Array.isArray(parsed)) {
          setProfileRelays(parsed)
        }
      } catch (e) {
        console.error('Failed to parse profile relays:', e)
      }
    }

    // Load simulate location setting
    const savedSimulate = localStorage.getItem('spotstr_simulateLocation')
    if (savedSimulate === 'true') {
      setSimulateLocation(true)
    }
  }, [])
  
  // Get connection status from shared state
  const isConnected = isRelayConnected(relayUrl)

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
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = () => {
    disconnectRelay(relayUrl)
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

  const handleProfileRelaysChange = (value: string) => {
    const relays = value.split('\n')
      .map(r => r.trim())
      .filter(r => r.length > 0)
    setProfileRelays(relays)
  }

  const saveProfileRelays = () => {
    localStorage.setItem('spotstr_profileRelays', JSON.stringify(profileRelays))
    toast({
      title: 'Saved',
      description: 'Profile relay settings have been saved',
      status: 'success',
      duration: 2000,
    })
  }

  const resetProfileRelays = () => {
    setProfileRelays(DEFAULT_PROFILE_RELAYS)
    localStorage.setItem('spotstr_profileRelays', JSON.stringify(DEFAULT_PROFILE_RELAYS))
    toast({
      title: 'Reset',
      description: 'Profile relays have been reset to defaults',
      status: 'info',
      duration: 2000,
    })
  }

  const handleSimulateToggle = (checked: boolean) => {
    setSimulateLocation(checked)
    localStorage.setItem('spotstr_simulateLocation', String(checked))
    toast({
      title: checked ? 'Simulation enabled' : 'Simulation disabled',
      description: checked ? 'Location will be simulated' : 'Using real device location',
      status: 'info',
      duration: 2000,
    })
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Text fontSize="lg" fontWeight="bold" color="gray.800">Settings</Text>
        <HStack spacing={2}>
          <Tooltip label="View on GitHub" placement="bottom">
            <Link href="https://github.com/k0sti/spotstr" isExternal>
              <IconButton
                aria-label="GitHub Repository"
                icon={
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                }
                size="sm"
                colorScheme="gray"
              />
            </Link>
          </Tooltip>
          <Tooltip label="About Spotstr" placement="bottom">
            <IconButton
              aria-label="Help"
              icon={<span style={{ fontSize: '1.5rem' }}>?</span>}
              size="sm"
              colorScheme="blue"
              onClick={onHelpOpen}
            />
          </Tooltip>
        </HStack>
      </HStack>
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

        <Divider my={6} />

        {/* Debug Settings */}
        <Box>
          <FormLabel>Debug Settings</FormLabel>
          <HStack justify="space-between" p={3} bg="yellow.50" borderRadius="md">
            <VStack align="start" spacing={0}>
              <Text fontSize="sm" fontWeight="medium">Simulate Location</Text>
              <Text fontSize="xs" color="gray.600">
                Circular movement around Madeira (5km radius, 10m/s)
              </Text>
            </VStack>
            <Switch
              isChecked={simulateLocation}
              onChange={(e) => handleSimulateToggle(e.target.checked)}
              colorScheme="yellow"
            />
          </HStack>
        </Box>

        <Divider my={6} />

        {/* Profile Relay Configuration */}
        <Box>
          <FormLabel>Profile Relays</FormLabel>
          <Text fontSize="xs" color="gray.600" mb={2}>
            These relays are used to fetch user profiles and metadata. Enter one relay URL per line.
          </Text>
          <Textarea
            value={profileRelays.join('\n')}
            onChange={(e) => handleProfileRelaysChange(e.target.value)}
            placeholder="Enter relay URLs (one per line)"
            rows={5}
            fontSize="sm"
            fontFamily="mono"
          />
        </Box>

        <HStack spacing={2}>
          <Button
            size="sm"
            colorScheme="blue"
            onClick={saveProfileRelays}
          >
            Save Profile Relays
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={resetProfileRelays}
          >
            Reset to Defaults
          </Button>
        </HStack>

      </VStack>

      {/* About Modal */}
      <Modal isOpen={isHelpOpen} onClose={onHelpClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>About Spotstr</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text>
                Spotstr is a privacy-focused location sharing application built on the Nostr protocol.
                It implements NIP-30473 for encrypted location events, allowing you to share your
                location securely with selected contacts or groups.
              </Text>

              <VStack align="stretch" spacing={2}>
                <Text fontSize="sm" fontWeight="semibold">Key Features:</Text>
                <Text fontSize="sm">• 🔐 End-to-end encrypted location sharing</Text>
                <Text fontSize="sm">• 👤 Multiple identity support (local, extension, Amber, Bunker)</Text>
                <Text fontSize="sm">• 👥 Group-based location sharing</Text>
                <Text fontSize="sm">• 📍 Public or private location events</Text>
                <Text fontSize="sm">• 🗺️ Real-time map visualization</Text>
                <Text fontSize="sm">• 🔄 Addressable events for location updates</Text>
              </VStack>

              <VStack align="stretch" spacing={2}>
                <Text fontSize="sm" fontWeight="semibold">Privacy & Security:</Text>
                <Text fontSize="sm">
                  All private location data is encrypted using NIP-44 encryption. Your private keys
                  never leave your device when using local identities. Location data uses geohash
                  encoding for efficient storage and querying.
                </Text>
              </VStack>

              <Divider />

              <HStack>
                <Text fontSize="sm" color="gray.600">Version:</Text>
                <Text fontSize="sm">1.0.0</Text>
              </HStack>
              <HStack>
                <Text fontSize="sm" color="gray.600">Protocol:</Text>
                <Text fontSize="sm">Nostr NIP-30473</Text>
              </HStack>
              <HStack>
                <Text fontSize="sm" color="gray.600">License:</Text>
                <Text fontSize="sm">MIT</Text>
              </HStack>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onHelpClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}