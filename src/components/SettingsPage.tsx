import { useState, useEffect } from 'react'
import { Box, Text, VStack, Button, HStack, useToast, Divider, Switch, IconButton, Tooltip, useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter, Link, useColorMode, FormLabel } from '@chakra-ui/react'
import { FaMoon, FaSun } from 'react-icons/fa'

export function SettingsPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { isOpen: isHelpOpen, onOpen: onHelpOpen, onClose: onHelpClose } = useDisclosure()
  const { colorMode, toggleColorMode } = useColorMode()
  const toast = useToast()
  const [simulateLocation, setSimulateLocation] = useState(false)

  useEffect(() => {
    // Load simulate location setting
    const savedSimulate = localStorage.getItem('spotstr_simulateLocation')
    if (savedSimulate === 'true') {
      setSimulateLocation(true)
    }
  }, [])

  const handleOpenRelayConfig = () => {
    if (onNavigate) {
      onNavigate('relays')
    }
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
        {/* Theme Settings */}
        <Box>
          <HStack justify="space-between" align="center">
            <VStack align="start" spacing={0}>
              <Text fontWeight="medium">Theme</Text>
              <Text fontSize="sm" color="gray.500">
                Switch between light and dark mode
              </Text>
            </VStack>
            <HStack spacing={2}>
              <Text fontSize="sm" color="gray.600">
                {colorMode === 'light' ? 'Light' : 'Dark'}
              </Text>
              <Button
                leftIcon={colorMode === 'light' ? <FaSun /> : <FaMoon />}
                onClick={toggleColorMode}
                size="sm"
                colorScheme={colorMode === 'light' ? 'yellow' : 'purple'}
                variant="outline"
              >
                {colorMode === 'light' ? 'Switch to Dark' : 'Switch to Light'}
              </Button>
            </HStack>
          </HStack>
        </Box>

        <Divider />

        {/* Relay Configuration */}
        <Box>
          <VStack align="start" spacing={2}>
            <Text fontWeight="medium">Relay Configuration</Text>
            <Text fontSize="sm" color="gray.500">
              Manage location and profile relays
            </Text>
            <Button
              colorScheme="blue"
              size="sm"
              onClick={handleOpenRelayConfig}
              leftIcon={<span>🔌</span>}
            >
              Configure Relays
            </Button>
          </VStack>
        </Box>

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