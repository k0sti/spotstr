import { useState, useEffect } from 'react'
import {
  Box,
  Text,
  Input,
  VStack,
  HStack,
  Button,
  IconButton,
  useToast,
  Divider,
  Tooltip,
  Badge,
  Flex,
  Heading,
  Switch,
  InputGroup,
  InputRightElement,
} from '@chakra-ui/react'
import { FaPlus, FaTrash, FaSync, FaCheckCircle, FaExclamationCircle, FaSpinner } from 'react-icons/fa'
import { useRelayService } from '../services/relayService'
import { RelayConfig, RelayType } from '../types/relay'
import { keyframes } from '@emotion/react'

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

const DEFAULT_LOCATION_RELAYS = [
  'wss://precision.bilberry-tetra.ts.net/relay',
  'wss://orangesync.tech'
]

const DEFAULT_PROFILE_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band'
]

export function RelayConfigPage() {
  const relayService = useRelayService()
  const toast = useToast()
  const [locationRelays, setLocationRelays] = useState<RelayConfig[]>([])
  const [profileRelays, setProfileRelays] = useState<RelayConfig[]>([])
  const [newLocationRelay, setNewLocationRelay] = useState('')
  const [newProfileRelay, setNewProfileRelay] = useState('')
  const [editingRelays, setEditingRelays] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Load relay configurations
    const loadRelays = () => {
      const locationConfigs = relayService.getRelayConfigs('location')
      const profileConfigs = relayService.getRelayConfigs('profile')
      setLocationRelays(locationConfigs)
      setProfileRelays(profileConfigs)
    }

    loadRelays()

    // Subscribe to relay status updates
    const subscription = relayService.relayStatus$.subscribe(() => {
      loadRelays()
    })

    return () => subscription.unsubscribe()
  }, [relayService])

  const handleToggleRelay = async (relay: RelayConfig) => {
    try {
      if (relay.enabled) {
        await relayService.disconnectRelay(relay.url)
      } else {
        await relayService.connectRelay(relay.url, relay.type)
      }

      // Reload relay configs
      const configs = relayService.getRelayConfigs(relay.type)
      if (relay.type === 'location') {
        setLocationRelays(configs)
      } else {
        setProfileRelays(configs)
      }
    } catch (error) {
      toast({
        title: 'Connection Error',
        description: `Failed to ${relay.enabled ? 'disconnect from' : 'connect to'} ${relay.url}`,
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleUpdateRelayUrl = (oldUrl: string, newUrl: string, type: RelayType) => {
    if (!newUrl || newUrl === oldUrl) {
      setEditingRelays(prev => {
        const next = new Set(prev)
        next.delete(oldUrl)
        return next
      })
      return
    }

    relayService.updateRelayUrl(oldUrl, newUrl, type)

    // Reload configs
    const configs = relayService.getRelayConfigs(type)
    if (type === 'location') {
      setLocationRelays(configs)
    } else {
      setProfileRelays(configs)
    }

    setEditingRelays(prev => {
      const next = new Set(prev)
      next.delete(oldUrl)
      return next
    })

    toast({
      title: 'Relay Updated',
      description: 'Relay URL has been updated',
      status: 'success',
      duration: 2000,
    })
  }

  const handleDeleteRelay = (url: string, type: RelayType) => {
    relayService.removeRelay(url, type)

    // Reload configs
    const configs = relayService.getRelayConfigs(type)
    if (type === 'location') {
      setLocationRelays(configs)
    } else {
      setProfileRelays(configs)
    }

    toast({
      title: 'Relay Removed',
      description: 'Relay has been removed from the list',
      status: 'info',
      duration: 2000,
    })
  }

  const handleAddRelay = (type: RelayType) => {
    const url = type === 'location' ? newLocationRelay : newProfileRelay

    if (!url) {
      toast({
        title: 'URL Required',
        description: 'Please enter a relay URL',
        status: 'warning',
        duration: 2000,
      })
      return
    }

    relayService.addRelay(url, type)

    // Clear input and reload
    if (type === 'location') {
      setNewLocationRelay('')
      setLocationRelays(relayService.getRelayConfigs('location'))
    } else {
      setNewProfileRelay('')
      setProfileRelays(relayService.getRelayConfigs('profile'))
    }

    toast({
      title: 'Relay Added',
      description: 'New relay has been added to the list',
      status: 'success',
      duration: 2000,
    })
  }

  const handleResetDefaults = (type: RelayType) => {
    const defaults = type === 'location' ? DEFAULT_LOCATION_RELAYS : DEFAULT_PROFILE_RELAYS
    relayService.resetToDefaults(type, defaults)

    // Reload configs
    const configs = relayService.getRelayConfigs(type)
    if (type === 'location') {
      setLocationRelays(configs)
    } else {
      setProfileRelays(configs)
    }

    toast({
      title: 'Reset to Defaults',
      description: `${type === 'location' ? 'Location' : 'Profile'} relays have been reset`,
      status: 'info',
      duration: 2000,
    })
  }

  const renderRelayRow = (relay: RelayConfig) => {
    const isEditing = editingRelays.has(relay.url)
    const statusColor = relay.status === 'connected' ? 'green' :
                       relay.status === 'error' ? 'red' :
                       relay.status === 'connecting' ? 'yellow' : 'gray'

    const statusIcon = relay.status === 'connected' ? <FaCheckCircle /> :
                      relay.status === 'error' ? <FaExclamationCircle /> :
                      relay.status === 'connecting' ? <Box as={FaSpinner} animation={`${spin} 1s linear infinite`} /> : null

    return (
      <HStack key={relay.url} spacing={3} p={3} bg="gray.50" borderRadius="md">
        <Switch
          isChecked={relay.enabled}
          onChange={() => handleToggleRelay(relay)}
          colorScheme="green"
        />

        <Tooltip
          label={
            relay.status === 'error' ? relay.errorMessage :
            relay.stats ? `Received: ${relay.stats.receivedEvents} | Sent: ${relay.stats.sentEvents}` :
            relay.status
          }
          placement="top"
        >
          <Badge colorScheme={statusColor} display="flex" alignItems="center" gap={1}>
            {statusIcon}
            <Text fontSize="xs" ml={1}>{relay.status}</Text>
          </Badge>
        </Tooltip>

        <Box flex={1}>
          {isEditing ? (
            <InputGroup size="sm">
              <Input
                defaultValue={relay.url}
                onBlur={(e) => handleUpdateRelayUrl(relay.url, e.target.value, relay.type)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleUpdateRelayUrl(relay.url, e.currentTarget.value, relay.type)
                  }
                }}
                autoFocus
              />
              <InputRightElement>
                <IconButton
                  aria-label="Cancel edit"
                  icon={<Text>✕</Text>}
                  size="xs"
                  variant="ghost"
                  onClick={() => setEditingRelays(prev => {
                    const next = new Set(prev)
                    next.delete(relay.url)
                    return next
                  })}
                />
              </InputRightElement>
            </InputGroup>
          ) : (
            <Text
              fontSize="sm"
              fontFamily="mono"
              cursor="pointer"
              onClick={() => setEditingRelays(prev => new Set(prev).add(relay.url))}
              _hover={{ textDecoration: 'underline' }}
            >
              {relay.url}
            </Text>
          )}
        </Box>

        <IconButton
          aria-label="Delete relay"
          icon={<FaTrash />}
          size="sm"
          colorScheme="red"
          variant="ghost"
          onClick={() => handleDeleteRelay(relay.url, relay.type)}
        />
      </HStack>
    )
  }

  return (
    <Box>
      <Heading size="md" mb={6}>Relay Configuration</Heading>

      {/* Location Relays Section */}
      <VStack spacing={4} align="stretch" mb={8}>
        <Flex justify="space-between" align="center">
          <Text fontSize="lg" fontWeight="bold">Location Relays</Text>
          <Button
            size="sm"
            leftIcon={<FaSync />}
            onClick={() => handleResetDefaults('location')}
            variant="outline"
          >
            Reset to Defaults
          </Button>
        </Flex>

        <VStack spacing={2} align="stretch">
          {locationRelays.map(relay => renderRelayRow(relay))}
        </VStack>

        <HStack>
          <Input
            placeholder="wss://relay.example.com"
            value={newLocationRelay}
            onChange={(e) => setNewLocationRelay(e.target.value)}
            size="sm"
          />
          <IconButton
            aria-label="Add location relay"
            icon={<FaPlus />}
            onClick={() => handleAddRelay('location')}
            colorScheme="green"
            size="sm"
          />
        </HStack>
      </VStack>

      <Divider my={6} />

      {/* Profile Relays Section */}
      <VStack spacing={4} align="stretch">
        <Flex justify="space-between" align="center">
          <Text fontSize="lg" fontWeight="bold">Profile Relays</Text>
          <Button
            size="sm"
            leftIcon={<FaSync />}
            onClick={() => handleResetDefaults('profile')}
            variant="outline"
          >
            Reset to Defaults
          </Button>
        </Flex>

        <VStack spacing={2} align="stretch">
          {profileRelays.map(relay => renderRelayRow(relay))}
        </VStack>

        <HStack>
          <Input
            placeholder="wss://relay.example.com"
            value={newProfileRelay}
            onChange={(e) => setNewProfileRelay(e.target.value)}
            size="sm"
          />
          <IconButton
            aria-label="Add profile relay"
            icon={<FaPlus />}
            onClick={() => handleAddRelay('profile')}
            colorScheme="green"
            size="sm"
          />
        </HStack>
      </VStack>
    </Box>
  )
}