import { Box, Flex, Text, IconButton, HStack, VStack, Tooltip, Circle, useColorModeValue, Image } from '@chakra-ui/react'
import { FaUsers, FaUser, FaCog, FaMapMarkedAlt, FaUserFriends, FaNetworkWired } from 'react-icons/fa'
import { IconType } from 'react-icons'
import { useEffect, useState } from 'react'
import { useRelayService } from '../services/relayService'

type PageType = 'identities' | 'contacts' | 'groups' | 'locations' | 'settings' | 'relays' | null

interface TopBarProps {
  currentPage: PageType
  onPageClick: (page: PageType) => void
}

interface NavItem {
  page: PageType
  label: string
  icon: IconType
}

export function TopBar({ currentPage, onPageClick }: TopBarProps) {
  const bgColor = useColorModeValue('rgba(255, 255, 255, 0.9)', 'rgba(26, 32, 44, 0.85)')
  const textColor = useColorModeValue('gray.800', 'white')
  const borderColor = useColorModeValue('rgba(0, 0, 0, 0.1)', 'rgba(255, 255, 255, 0.1)')
  const buttonColor = useColorModeValue('gray.600', 'gray.300')
  const hoverBg = useColorModeValue('rgba(0, 0, 0, 0.05)', 'rgba(255, 255, 255, 0.1)')

  const relayService = useRelayService()
  const [locationRelaysConnected, setLocationRelaysConnected] = useState(false)
  const [profileRelaysConnected, setProfileRelaysConnected] = useState(false)

  useEffect(() => {
    const subscription = relayService.relayStatus$.subscribe(() => {
      const locationRelays = relayService.getConnectedRelays('location')
      const profileRelays = relayService.getConnectedRelays('profile')
      setLocationRelaysConnected(locationRelays.length > 0)
      setProfileRelaysConnected(profileRelays.length > 0)
    })

    return () => subscription.unsubscribe()
  }, [relayService])

  const navItems: NavItem[] = [
    { page: 'identities', label: 'Identities', icon: FaUser },
    { page: 'contacts', label: 'Contacts', icon: FaUserFriends },
    { page: 'groups', label: 'Groups', icon: FaUsers },
    { page: 'locations', label: 'Locations', icon: FaMapMarkedAlt },
    { page: 'settings', label: 'Settings', icon: FaCog }
  ]

  return (
    <Box
      position="fixed"
      top="0"
      left="0"
      right="0"
      zIndex={1000}
      paddingTop="var(--safe-area-inset-top)"
      bg={bgColor}
      backdropFilter="blur(10px)"
      borderBottom={`1px solid ${borderColor}`}
      boxShadow="0 2px 10px rgba(0, 0, 0, 0.3)"
    >
      <Flex
        justify="space-between"
        align="center"
        px={4}
        py={2}
      >
        <HStack spacing={2} align="center">
          <Image
            src="/icon-512.png"
            alt="Spotstr logo"
            boxSize="32px"
            borderRadius="md"
          />
          <Text fontSize="xl" fontWeight="bold" color={textColor}>
            Spotstr
          </Text>
        </HStack>

        <HStack spacing={0}>
          {navItems.map(({ page, label, icon: Icon }) => (
            <Tooltip key={page} label={label} placement="bottom">
              <IconButton
                aria-label={label}
                icon={<Icon />}
                onClick={() => onPageClick(page)}
                colorScheme={currentPage === page ? 'blue' : 'gray'}
                variant={currentPage === page ? 'solid' : 'ghost'}
                fontSize="25"
                size="md"
                color={currentPage === page ? textColor : buttonColor}
                _hover={{ bg: hoverBg }}
              />
            </Tooltip>
          ))}

          <VStack spacing={1} ml={2}>
            <Tooltip
              label={
                <Box>
                  <Text fontSize="xs">Location relays: {locationRelaysConnected ? 'Connected' : 'Disconnected'}</Text>
                  <Text fontSize="xs">Profile relays: {profileRelaysConnected ? 'Connected' : 'Disconnected'}</Text>
                </Box>
              }
              placement="bottom"
            >
              <HStack spacing={1}>
                <Circle
                  size="8px"
                  bg={locationRelaysConnected ? 'green.400' : 'gray.400'}
                  boxShadow={locationRelaysConnected ? '0 0 6px rgba(72, 187, 120, 0.6)' : 'none'}
                />
                <Circle
                  size="8px"
                  bg={profileRelaysConnected ? 'green.400' : 'gray.400'}
                  boxShadow={profileRelaysConnected ? '0 0 6px rgba(72, 187, 120, 0.6)' : 'none'}
                />
              </HStack>
            </Tooltip>

            <Tooltip label="Configure Relays" placement="bottom">
              <IconButton
                aria-label="Configure Relays"
                icon={<FaNetworkWired />}
                onClick={() => onPageClick('relays')}
                colorScheme={currentPage === 'relays' ? 'blue' : 'gray'}
                variant={currentPage === 'relays' ? 'solid' : 'ghost'}
                size="xs"
                fontSize="14px"
                color={currentPage === 'relays' ? textColor : buttonColor}
                _hover={{ bg: hoverBg }}
              />
            </Tooltip>
          </VStack>
        </HStack>
      </Flex>
    </Box>
  )
}