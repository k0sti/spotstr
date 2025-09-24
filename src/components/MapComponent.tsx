import { useEffect, useRef, useState } from 'react'
import { Box, IconButton, Tooltip, Input, HStack, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, Text } from '@chakra-ui/react'
import L from 'leaflet'
import { mapService, MapLocation } from '../services/mapService'
import { generateGeohash, decodeGeohash } from '../utils/crypto'

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css'

// Create custom marker icons for public and private events
const createMarkerIcon = (color: string) => L.divIcon({
  html: `
    <div style="
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      width: 12px;
      height: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>
  `,
  className: 'custom-marker',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -6]
})

const publicIcon = createMarkerIcon('#2563eb') // blue
const privateIcon = createMarkerIcon('#dc2626') // red

export function MapComponent() {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const rectanglesRef = useRef<Map<string, L.Rectangle>>(new Map())
  const [locations, setLocations] = useState<MapLocation[]>([])
  const [isQueryingLocation, setIsQueryingLocation] = useState(false)
  const watchIdRef = useRef<number | null>(null)
  const [geohashInput, setGeohashInput] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)
  const userLocationMarkerRef = useRef<L.Rectangle | null>(null)
  const userLocationCenterRef = useRef<L.Marker | null>(null)
  const firstLocationReceived = useRef(false)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    // Initialize Leaflet map - center at UTC0 (0 longitude) with a wide view showing most of the world
    // Disable default zoom controls
    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false
    }).setView([40, 0], 3)

    // Add OpenStreetMap tiles
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapRef.current)

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Subscribe to location updates from the map service
  useEffect(() => {
    const locationsSub = mapService.getLocations().subscribe(setLocations)
    return () => locationsSub.unsubscribe()
  }, [])

  // Subscribe to focused location changes
  useEffect(() => {
    const focusSub = mapService.getFocusedLocation().subscribe(location => {
      if (location && mapRef.current) {
        // Fit bounds to show the entire geohash rectangle
        const bounds = L.latLngBounds(
          [location.bounds.minLat, location.bounds.minLng],
          [location.bounds.maxLat, location.bounds.maxLng]
        )
        mapRef.current.fitBounds(bounds, {
          animate: true,
          duration: 0.5,
          padding: [50, 50]
        })

        // Highlight the focused rectangle
        const rect = rectanglesRef.current.get(location.id)
        if (rect) {
          const isPublic = location.event.eventKind === 30472
          const defaultColor = isPublic ? '#2563eb' : '#dc2626'
          rect.setStyle({ color: '#fbbf24', weight: 3 }) // yellow highlight
          setTimeout(() => {
            rect.setStyle({ color: defaultColor, weight: 2 })
          }, 2000)
        }
      }
    })
    return () => focusSub.unsubscribe()
  }, [])

  // Update rectangles and markers when locations change
  useEffect(() => {
    if (!mapRef.current) return

    // Clear existing rectangles, markers, and circles
    rectanglesRef.current.forEach(rect => {
      rect.remove()
      // Also remove the associated marker and accuracy circle
      if ((rect as any)._associatedMarker) {
        (rect as any)._associatedMarker.remove()
      }
      if ((rect as any)._associatedCircle) {
        (rect as any)._associatedCircle.remove()
      }
    })
    rectanglesRef.current.clear()

    // Add rectangles and center markers for each location
    locations.forEach(location => {
      const bounds = L.latLngBounds(
        [location.bounds.minLat, location.bounds.minLng],
        [location.bounds.maxLat, location.bounds.maxLng]
      )

      // Determine colors based on event kind
      const isPublic = location.event.eventKind === 30472
      const rectangleColor = isPublic ? '#2563eb' : '#dc2626' // blue for public, red for private
      const markerIcon = isPublic ? publicIcon : privateIcon

      // Add rectangle for the geohash bounds
      const rectangle = L.rectangle(bounds, {
        color: rectangleColor,
        weight: 2,
        opacity: 0.8,
        fillColor: rectangleColor,
        fillOpacity: 0.2
      })
        .addTo(mapRef.current!)

      // Add marker at the center of the location with appropriate icon
      const marker = L.marker([location.lat, location.lng], { icon: markerIcon })
        .addTo(mapRef.current!)
        .bindPopup(`
          <div>
            <strong>${location.event.name || location.event.dTag || 'Location'}</strong><br/>
            Type: ${location.event.eventKind === 30472 ? 'Public' : 'Private'}<br/>
            Geohash: ${location.event.geohash}<br/>
            From: ${location.event.senderNpub.slice(0, 8)}...<br/>
            ${location.event.tags?.accuracy ? `Accuracy: ${location.event.tags.accuracy}m` : ''}
            ${location.event.tags?.title ? `<br/>Title: ${location.event.tags.title}` : ''}
          </div>
        `)

      // Add accuracy circle if accuracy is available
      let accuracyCircle = null
      const accuracy = location.event.tags?.accuracy
      if (accuracy && accuracy > 0) {
        const circleColor = isPublic ? '#3b82f6' : '#ef4444' // blue-500 for public, red-500 for private
        accuracyCircle = L.circle([location.lat, location.lng], {
          radius: accuracy, // radius in meters
          color: circleColor,
          weight: 1,
          opacity: 0.6,
          fillColor: circleColor,
          fillOpacity: 0.1
        }).addTo(mapRef.current!)

      }

      // Store rectangle reference for highlighting
      rectanglesRef.current.set(location.id, rectangle)
      
      // Store marker and accuracy circle with rectangle so they're removed together
      ;(rectangle as any)._associatedMarker = marker
      if (accuracyCircle) {
        ;(rectangle as any)._associatedCircle = accuracyCircle
      }
    })
  }, [locations])

  const toggleLocationQuery = () => {
    if (isQueryingLocation) {
      // Stop querying location
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      setIsQueryingLocation(false)
      firstLocationReceived.current = false
    } else {
      // Start querying location
      if ('geolocation' in navigator) {
        setIsQueryingLocation(true)
        firstLocationReceived.current = false

        // Get current position once
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const geohash = generateGeohash(position.coords.latitude, position.coords.longitude, 8)
            setGeohashInput(geohash)

            if (mapRef.current && !firstLocationReceived.current) {
              // For GPS location, focus on the geohash bounds
              const decoded = decodeGeohash(geohash)
              if (decoded) {
                const bounds = L.latLngBounds(
                  [decoded.bounds.minLat, decoded.bounds.minLng],
                  [decoded.bounds.maxLat, decoded.bounds.maxLng]
                )
                mapRef.current.fitBounds(bounds, {
                  animate: true,
                  duration: 0.5,
                  padding: [50, 50]
                })
              }
              firstLocationReceived.current = true
            }
          },
          (error) => {
            console.error('Error getting location:', error)
            setIsQueryingLocation(false)
          },
          { enableHighAccuracy: true }
        )

        // Watch for position changes
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const geohash = generateGeohash(position.coords.latitude, position.coords.longitude, 8)
            setGeohashInput(geohash)

            // Don't focus map on subsequent updates
          },
          (error) => {
            console.error('Error watching location:', error)
          },
          { enableHighAccuracy: true }
        )
      } else {
        console.error('Geolocation is not supported by this browser')
      }
    }
  }

  // Clean up location watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  // Handle geohash input changes - display on map
  useEffect(() => {
    if (!mapRef.current) return

    // Remove previous user location marker
    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.remove()
      userLocationMarkerRef.current = null
    }
    if (userLocationCenterRef.current) {
      userLocationCenterRef.current.remove()
      userLocationCenterRef.current = null
    }

    if (geohashInput && geohashInput.length >= 1) {
      const decoded = decodeGeohash(geohashInput)
      if (decoded) {
        // Add green rectangle for the geohash bounds
        const bounds = L.latLngBounds(
          [decoded.bounds.minLat, decoded.bounds.minLng],
          [decoded.bounds.maxLat, decoded.bounds.maxLng]
        )

        userLocationMarkerRef.current = L.rectangle(bounds, {
          color: '#10b981',  // green-500
          weight: 2,
          opacity: 0.8,
          fillColor: '#10b981',
          fillOpacity: 0.2
        }).addTo(mapRef.current)

        // Add green center marker
        const greenIcon = L.divIcon({
          html: `
            <div style="
              background: #10b981;
              border: 2px solid white;
              border-radius: 50%;
              width: 12px;
              height: 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>
          `,
          className: 'custom-green-marker',
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })

        userLocationCenterRef.current = L.marker([decoded.lat, decoded.lng], { icon: greenIcon })
          .addTo(mapRef.current)

        // Focus map on this location if user typed it (not from location query)
        if (!isQueryingLocation) {
          // Fit the map to show the entire geohash rectangle with some padding
          mapRef.current.fitBounds(bounds, {
            animate: true,
            duration: 0.5,
            padding: [50, 50] // Add padding around the bounds
          })
        }
      }
    }
  }, [geohashInput, isQueryingLocation])

  const handleGeohashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isQueryingLocation) {
      setGeohashInput(e.target.value)
    }
  }

  const handleShareLocation = () => {
    setShowShareModal(true)
  }

  return (
    <Box position="relative" width="100%" height="100%" overflow="hidden">
      <Box
        ref={mapContainerRef}
        data-testid="map-container"
        width="100%"
        height="100%"
      />

      {/* Location Panel */}
      <Box
        position="absolute"
        top="80px"
        right="4"
        zIndex="1000"
        bg="white"
        borderRadius="md"
        boxShadow="md"
        p={2}
      >
        <HStack spacing={2}>
          <Tooltip label="Your location as geohash" placement="bottom">
            <Input
              placeholder="Geohash"
              value={geohashInput}
              onChange={handleGeohashChange}
              isDisabled={isQueryingLocation}
              size="sm"
              width="150px"
              fontFamily="mono"
            />
          </Tooltip>
          <Tooltip label="Share location">
            <IconButton
              aria-label="Share Location"
              icon={<span>📤</span>}
              size="sm"
              onClick={handleShareLocation}
              variant="outline"
            />
          </Tooltip>
          <Tooltip label={isQueryingLocation ? 'Stop tracking' : 'Track location'}>
            <IconButton
              aria-label="Query Location"
              icon={<span>📍</span>}
              size="sm"
              onClick={toggleLocationQuery}
              colorScheme={isQueryingLocation ? 'blue' : 'gray'}
              variant={isQueryingLocation ? 'solid' : 'outline'}
            />
          </Tooltip>
        </HStack>
      </Box>

      {/* Share Modal */}
      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Share Location</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Text>To be implemented</Text>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  )
}