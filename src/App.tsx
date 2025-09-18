import { ChakraProvider } from '@chakra-ui/react'
import { useState } from 'react'
import { IdentitiesPage } from './components/IdentitiesPage'
import { LocationsPage } from './components/LocationsPage'
import { ContactsPage } from './components/ContactsPage'
import { SettingsPage } from './components/SettingsPage'
import { EventLogPage } from './components/EventLogPage'
import { MapComponent } from './components/MapComponent'
import { 
  Box, 
  Flex, 
  Text, 
  IconButton, 
  HStack 
} from '@chakra-ui/react'

type PageType = 'identities' | 'locations' | 'contacts' | 'settings' | 'eventlog'

export function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('identities')

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'identities':
        return <IdentitiesPage />
      case 'locations':
        return <LocationsPage />
      case 'contacts':
        return <ContactsPage />
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
          bg="white" 
          shadow="md" 
          zIndex="1000"
          p={4}
        >
          <Flex justify="space-between" align="center">
            <Text fontSize="xl" fontWeight="bold">Spotstr</Text>
            
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
                aria-label="Contacts"
                icon={<span>👥</span>}
                size="sm"
                onClick={() => setCurrentPage('contacts')}
                variant={currentPage === 'contacts' ? 'solid' : 'outline'}
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
            </HStack>
          </Flex>
        </Box>

        {/* Page Content */}
        <Box 
          position="absolute"
          top="20"
          left="4"
          bg="white"
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