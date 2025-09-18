import { ChakraProvider } from '@chakra-ui/react'
import { useState } from 'react'
import { IdentitiesPage } from './components/IdentitiesPage'
import { LocationsPage } from './components/LocationsPage'
import { SettingsPage } from './components/SettingsPage'
import { EventLogPage } from './components/EventLogPage'
import { MapComponent } from './components/MapComponent'
import { useNostr } from './hooks/useNostr'
import { 
  Box, 
  Flex, 
  Text, 
  IconButton, 
  HStack,
  Tooltip,
  Circle,
  Link
} from '@chakra-ui/react'

type PageType = 'identities' | 'locations' | 'settings' | 'eventlog'

function AppContent() {
  const [currentPage, setCurrentPage] = useState<PageType>('identities')
  const { connectedRelays } = useNostr()
  const isConnected = connectedRelays.length > 0

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'identities':
        return <IdentitiesPage />
      case 'locations':
        return <LocationsPage />
      case 'settings':
        return <SettingsPage />
      case 'eventlog':
        return <EventLogPage />
      default:
        return <IdentitiesPage />
    }
  }

  return (
    <ChakraProvider>
      <Box height="100vh" position="relative">
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
          p={4}
        >
          <Flex justify="space-between" align="center">
            <HStack spacing={3}>
              <Text fontSize="xl" fontWeight="bold" color="gray.800">Spotstr</Text>
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
            
            <HStack spacing={2}>
              <IconButton
                aria-label="Identities"
                icon={<span>👤</span>}
                size="sm"
                onClick={() => setCurrentPage('identities')}
                variant={currentPage === 'identities' ? 'solid' : 'outline'}
              />
              <IconButton
                aria-label="Locations"
                icon={<span>📍</span>}
                size="sm"
                onClick={() => setCurrentPage('locations')}
                variant={currentPage === 'locations' ? 'solid' : 'outline'}
              />
              <IconButton
                aria-label="Settings"
                icon={<span>⚙️</span>}
                size="sm"
                onClick={() => setCurrentPage('settings')}
                variant={currentPage === 'settings' ? 'solid' : 'outline'}
              />
              <IconButton
                aria-label="Event Log"
                icon={<span>📋</span>}
                size="sm"
                onClick={() => setCurrentPage('eventlog')}
                variant={currentPage === 'eventlog' ? 'solid' : 'outline'}
              />
              <Link href="https://github.com/k0sti/spotstr" isExternal>
                <IconButton
                  aria-label="GitHub Repository"
                  icon={
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="currentColor"
                    >
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                  }
                  size="sm"
                  variant="outline"
                />
              </Link>
            </HStack>
          </Flex>
        </Box>

        {/* Page Content */}
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
      </Box>
    </ChakraProvider>
  )
}

export function App() {
  return (
    <ChakraProvider>
      <AppContent />
    </ChakraProvider>
  )
}