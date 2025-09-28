import { ChakraProvider, ColorModeScript, useColorModeValue } from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import theme from './theme'
import { safeAreaService } from './services/safeAreaService'
import { IdentitiesPage } from './components/IdentitiesPage'
import { LocationsPage } from './components/LocationsPage'
import { SettingsPage } from './components/SettingsPage'
import { ContactsPage } from './components/ContactsPage'
import { GroupsPage } from './components/GroupsPage'
import { MapView } from './components/MapView'
import { TopBar } from './components/TopBar'
import { LocationBar } from './components/LocationBar'
import { ShareLocationPopup } from './components/ShareLocationPopup'
import { useNostr } from './hooks/useNostr'
import { AccountsProvider } from 'applesauce-react'
import { useAccounts } from 'applesauce-react/hooks'
import accounts from './services/accounts'
import { groupsManager } from './services/groups'
import { continuousSharingService, ContinuousSharingState } from './services/continuousSharingService'
import { Box, useToast } from '@chakra-ui/react'

type PageType = 'identities' | 'contacts' | 'groups' | 'locations' | 'settings' | null

function AppContent() {
  const [currentPage, setCurrentPage] = useState<PageType>(null)
  const { connectedRelays, setAccounts } = useNostr()
  const accountsList = useAccounts()
  const toast = useToast()
  const isConnected = connectedRelays.length > 0
  const modalBg = useColorModeValue('white', 'gray.800')

  // Location-related state
  const [geohashInput, setGeohashInput] = useState('')
  const [isQueryingLocation, setIsQueryingLocation] = useState(false)
  const [locationButtonColor, setLocationButtonColor] = useState<'gray' | 'blue' | 'red' | 'yellow'>('gray')
  const [continuousSharingState, setContinuousSharingState] = useState<ContinuousSharingState>(
    continuousSharingService.getCurrentState()
  )
  const [showShareModal, setShowShareModal] = useState(false)

  // Initialize safe area service on mount
  useEffect(() => {
    safeAreaService.initialize().catch(error => {
      console.error('Failed to initialize safe area service:', error)
    })
  }, [])

  // Automatically sync accounts with NostrService for decryption
  useEffect(() => {
    setAccounts(accountsList)
  }, [accountsList, setAccounts])

  // Also trigger decryption when groups change
  useEffect(() => {
    const updateGroups = () => {
      console.log('[App] Groups updated, triggering decryption attempt for new groups')
      setAccounts(accountsList)
    }

    const subscription = groupsManager.groups$.subscribe(updateGroups)
    return () => subscription.unsubscribe()
  }, [accountsList, setAccounts])

  // Subscribe to continuous sharing state
  useEffect(() => {
    const subscription = continuousSharingService.state$.subscribe(
      setContinuousSharingState
    )
    return () => subscription.unsubscribe()
  }, [])

  const handlePageClick = (page: PageType) => {
    // Toggle off if clicking the currently active page
    if (currentPage === page) {
      setCurrentPage(null)
    } else {
      setCurrentPage(page)
    }
  }

  const handleToggleLocation = () => {
    setIsQueryingLocation(!isQueryingLocation)
    if (!isQueryingLocation) {
      setLocationButtonColor('blue')
    } else {
      setLocationButtonColor('gray')
    }
  }

  const handleShareLocation = () => {
    setShowShareModal(true)
  }

  const handleStopSharing = async () => {
    await continuousSharingService.stopContinuousSharing()
    toast({
      title: 'Stopped sharing',
      description: 'Location sharing has been stopped',
      status: 'info',
      duration: 2000,
    })
  }

  const handleLocationUpdate = (geohash: string) => {
    setGeohashInput(geohash)
    // Blink yellow then back to blue for updates
    setLocationButtonColor('yellow')
    setTimeout(() => setLocationButtonColor('blue'), 200)
  }

  const [manualGeohashFocus, setManualGeohashFocus] = useState(false)

  const handleGeohashSubmit = () => {
    if (geohashInput) {
      // Trigger map focus on the geohash
      setManualGeohashFocus(true)
      // Reset the focus trigger after a short delay
      setTimeout(() => setManualGeohashFocus(false), 100)
    }
  }

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
        return null
    }
  }

  return (
    <ChakraProvider theme={theme}>
      <Box position="relative" width="100vw" height="100vh" overflow="hidden">
        {/* Full-screen Map Background */}
        <MapView
          geohashInput={geohashInput}
          isQueryingLocation={isQueryingLocation}
          onLocationUpdate={handleLocationUpdate}
          shouldFocusGeohash={manualGeohashFocus}
        />

        {/* Floating Top Bar */}
        <TopBar
          currentPage={currentPage}
          onPageClick={handlePageClick}
          isConnected={isConnected}
          connectedRelays={connectedRelays}
        />

        {/* Floating Location Bar */}
        <LocationBar
          geohashInput={geohashInput}
          onGeohashChange={setGeohashInput}
          onGeohashSubmit={handleGeohashSubmit}
          onToggleLocation={handleToggleLocation}
          onShareLocation={handleShareLocation}
          onStopSharing={handleStopSharing}
          isQueryingLocation={isQueryingLocation}
          locationButtonColor={locationButtonColor}
          continuousSharingState={continuousSharingState}
        />

        {/* Page Content - Floating Modal */}
        {currentPage && (
          <Box
            position="fixed"
            top="calc(60px + var(--safe-area-inset-top))"
            left="50%"
            transform="translateX(-50%)"
            bg={modalBg}
            shadow="2xl"
            rounded="lg"
            p={6}
            minW={{ base: "90vw", md: "500px" }}
            maxW="90vw"
            maxH="calc(80vh - var(--safe-area-inset-top) - var(--safe-area-inset-bottom))"
            overflow="auto"
            zIndex={1002}
          >
            {renderCurrentPage()}
          </Box>
        )}

        {/* Share Location Modal */}
        <ShareLocationPopup
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          initialGeohash={geohashInput}
        />
      </Box>
    </ChakraProvider>
  )
}

export default function App() {
  return (
    <>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <AccountsProvider manager={accounts}>
        <AppContent />
      </AccountsProvider>
    </>
  )
}