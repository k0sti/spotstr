import { ChakraProvider } from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { IdentitiesPage } from './components/IdentitiesPage'
import { LocationsPage } from './components/LocationsPage'
import { SettingsPage } from './components/SettingsPage'
import { ContactsPage } from './components/ContactsPage'
import { GroupsPage } from './components/GroupsPage'
import { MapComponent } from './components/MapComponent'
import { useNostr } from './hooks/useNostr'
import { AccountsProvider } from 'applesauce-react'
import accounts from './services/accounts'
import { groupsManager } from './services/groups'
// import theme from './theme'
import {
  Box,
  Flex,
  Text,
  IconButton,
  HStack,
  Tooltip,
  Circle,
  Image,
  useToast
} from '@chakra-ui/react'

type PageType = 'identities' | 'contacts' | 'groups' | 'locations' | 'settings' | null

function AppContent() {
  const [currentPage, setCurrentPage] = useState<PageType>(null)
  const { connectedRelays } = useNostr()
  const toast = useToast()
  const isConnected = connectedRelays.length > 0

  const handlePageClick = (page: PageType) => {
    // Toggle off if clicking the currently active page
    if (currentPage === page) {
      setCurrentPage(null)
    } else {
      setCurrentPage(page)
    }
  }

  // Check for group import in URL query parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const hexNsec = urlParams.get('g')

    if (hexNsec) {
      const group = groupsManager.importFromUrl(urlParams)
      if (group) {
        toast({
          title: 'Group imported',
          description: `Successfully imported group: ${group.name}`,
          status: 'success',
          duration: 3000,
        })
      } else {
        toast({
          title: 'Import failed',
          description: 'This group may already exist or the URL is invalid',
          status: 'error',
          duration: 5000,
        })
      }

      // Clear URL parameters
      window.history.replaceState({}, '', '/')
    }
  }, [toast])


  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'identities':
        return <IdentitiesPage />
      case 'contacts':
        return <ContactsPage />
      case 'groups':
        return <GroupsPage />
      case 'locations':
        return <LocationsPage onClose={() => setCurrentPage(null)} />
      case 'settings':
        return <SettingsPage />
      default:
        return <IdentitiesPage />
    }
  }

  return (
    <ChakraProvider>
      <Box height="100dvh" position="relative">
        {/* Background Map */}
        <MapComponent />
        
        {/* Top Bar */}
        <Box 
          position="absolute" 
          top="0" 
          left="0" 
          right="0" 
          bg="gray.100" 
          shadow="md" 
          zIndex="1000"
          p={2}
        >
          <Flex justify="space-between" align="center">
            <HStack spacing={3}>
              <HStack
                spacing={2}
                cursor="pointer"
                _hover={{ opacity: 0.8 }}
                onClick={() => window.location.href = '/'}
              >
                <Image
                  src="/icon-512.png"
                  alt="Spotstr Logo"
                  boxSize="32px"
                />
                <Text
                  fontSize="xl"
                  fontWeight="bold"
                  color="gray.800"
                >
                  Spotstr
                </Text>
              </HStack>
              <Tooltip 
                label={isConnected ? `Connected to ${connectedRelays.length} relay${connectedRelays.length > 1 ? 's' : ''}` : 'No relay connection'}
                placement="bottom"
              >
                <Circle 
                  size="10px" 
                  bg={isConnected ? 'green.500' : 'gray.400'}
                  boxShadow={isConnected ? '0 0 8px rgba(72, 187, 120, 0.5)' : 'none'}
                />
              </Tooltip>
            </HStack>
            
            <HStack spacing={0}>
              {[
                { page: 'identities' as const, label: 'Identities', icon: '👤' },
                { page: 'groups' as const, label: 'Groups', icon: '👥' },
                { page: 'contacts' as const, label: 'Contacts', icon: '🔗' },
                { page: 'locations' as const, label: 'Locations', icon: '📍' },
                { page: 'settings' as const, label: 'Settings', icon: '⚙️' },
              ].map(({ page, label, icon }) => (
                <Tooltip key={page} label={label} placement="bottom">
                  <IconButton
                    aria-label={label}
                    icon={<span style={{ fontSize: '1.5rem' }}>{icon}</span>}
                    size="md"
                    onClick={() => handlePageClick(page)}
                    variant={currentPage === page ? 'solid' : 'outline'}
                  />
                </Tooltip>
              ))}
            </HStack>
          </Flex>
        </Box>

        {/* Page Content */}
        {currentPage && (
          <Box
            position="absolute"
            top="20"
            left="4"
            bg="gray.50"
            shadow="lg"
            rounded="md"
            p={6}
            minW="400px"
            maxH="80vh"
            overflow="auto"
            zIndex="999"
          >
            {renderCurrentPage()}
          </Box>
        )}
      </Box>
    </ChakraProvider>
  )
}

export function App() {
  return (
    <ChakraProvider>
      <AccountsProvider manager={accounts}>
        <AppContent />
      </AccountsProvider>
    </ChakraProvider>
  )
}