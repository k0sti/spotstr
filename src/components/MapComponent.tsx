import { useEffect, useRef, useState } from 'react'
import { Box, IconButton, Tooltip, Input, HStack, useToast, Badge } from '@chakra-ui/react'
import L from 'leaflet'
import { mapService, MapLocation } from '../services/mapService'
import { generateGeohash, decodeGeohash } from '../utils/crypto'
import { getGeolocationImplementation } from '../utils/locationSimulator'
import { ShareLocationPopup } from './ShareLocationPopup'

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

// Helper function to create popup HTML with styled badges and copy functionality
const createPopupContent = (location: MapLocation): string => {
  const event = location.event
  const isPublic = event.eventKind === 30472

  // Escape strings for safe use in HTML attributes
  const escapeHtml = (str: string) => {
    return str.replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  // Build hashtags HTML if they exist
  let hashtagsHtml = ''
  if (event.tags?.t && Array.isArray(event.tags.t)) {
    hashtagsHtml = event.tags.t.map((tag: string) => {
      const escapedTag = escapeHtml(tag)
      return `<span onclick="window.mapCopyToClipboard('${escapedTag}', 'Hashtag')" style="
        background: #6b7280;
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        margin-right: 4px;
        display: inline-block;
        cursor: pointer;
      " title="Click to copy">#${tag}</span>`
    }).join('')
  }

  // Build other tags HTML (excluding special ones)
  const excludeKeys = ['t', 'g', 'title', 'accuracy', 'expiration']
  let otherTagsHtml = ''
  if (event.tags) {
    Object.entries(event.tags).forEach(([key, value]) => {
      if (!excludeKeys.includes(key) && value) {
        const escapedValue = escapeHtml(String(value))
        otherTagsHtml += `<div style="font-size: 12px; margin-top: 2px;">
          <strong>${key}:</strong>
          <span onclick="window.mapCopyToClipboard('${escapedValue}', '${key}')" style="
            cursor: pointer;
            text-decoration: underline;
            text-decoration-style: dotted;
          " title="Click to copy">${value}</span>
        </div>`
      }
    })
  }

  return `
    <div style="font-family: -apple-system, system-ui, sans-serif; min-width: 200px;">
      ${event.name || event.dTag ? `<div style="font-weight: bold; margin-bottom: 8px;">${event.name || event.dTag}</div>` : ''}

      <!-- First line: Type and Geohash badges -->
      <div style="margin-bottom: 6px;">
        <span style="
          background: ${isPublic ? '#3b82f6' : '#dc2626'};
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          margin-right: 4px;
        ">${isPublic ? 'Public' : 'Private'}</span>
        <span onclick="window.mapCopyToClipboard('${escapeHtml(event.geohash)}', 'Geohash')" style="
          background: #10b981;
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          font-family: monospace;
        " title="Click to copy">${event.geohash}</span>
      </div>

      <!-- Hashtags line if exists -->
      ${hashtagsHtml ? `<div style="margin-bottom: 6px;">${hashtagsHtml}</div>` : ''}

      <!-- Source line -->
      <div style="margin-bottom: 6px;">
        <span style="font-size: 12px; color: #4b5563;">source:</span>
        <span onclick="window.mapCopyToClipboard('${escapeHtml(event.senderNpub)}', 'Public key')" style="
          background: #fbbf24;
          color: #78350f;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          font-family: monospace;
          margin-left: 4px;
        " title="Click to copy">${event.senderNpub.slice(0, 8)}...</span>
      </div>

      <!-- Accuracy if present -->
      ${event.tags?.accuracy ? `<div style="font-size: 12px; margin-top: 2px;">
        <strong>accuracy:</strong>
        <span onclick="window.mapCopyToClipboard('${event.tags.accuracy}', 'Accuracy')" style="
          cursor: pointer;
          text-decoration: underline;
          text-decoration-style: dotted;
        " title="Click to copy">${event.tags.accuracy}m</span>
      </div>` : ''}

      <!-- Other tags -->
      ${otherTagsHtml}
    </div>
  `
}

export function MapComponent() {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const rectanglesRef = useRef<Map<string, L.Rectangle>>(new Map())
  const [locations, setLocations] = useState<MapLocation[]>([])
  const [isQueryingLocation, setIsQueryingLocation] = useState(false)
  const watchIdRef = useRef<number | null>(null)
  const [geohashInput, setGeohashInput] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareStatus, setShareStatus] = useState<{ type: 'sending' | 'sent' | 'error' | 'waiting', count?: number, message?: string } | null>(null)
  const [locationButtonColor, setLocationButtonColor] = useState<'gray' | 'blue' | 'red' | 'yellow'>('gray')
  const userLocationMarkerRef = useRef<L.Rectangle | null>(null)
  const userLocationCenterRef = useRef<L.Marker | null>(null)
  const firstLocationReceived = useRef(false)
  const toast = useToast()

  // Copy to clipboard with toast notification
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: `${label} copied`,
        status: 'success',
        duration: 2000,
      })
    } catch (error) {
      toast({
        title: 'Failed to copy',
        status: 'error',
        duration: 2000,
      })
    }
  }

  // Make the copy function available globally for popup clicks
  useEffect(() => {
    (window as any).mapCopyToClipboard = copyToClipboard
    return () => {
      delete (window as any).mapCopyToClipboard
    }
  }, [copyToClipboard])

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
        .bindPopup(createPopupContent(location))

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
    const geolocation = getGeolocationImplementation()

    if (isQueryingLocation) {
      // Stop querying location
      console.log('[MapComponent] Stopping location, watchId:', watchIdRef.current)
      if (watchIdRef.current !== null) {
        geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      setIsQueryingLocation(false)
      setLocationButtonColor('gray')
      firstLocationReceived.current = false
    } else {
      // Start querying location
      if ('geolocation' in navigator || geolocation) {
        setIsQueryingLocation(true)
        setLocationButtonColor('blue')
        firstLocationReceived.current = false

        // Get current position once
        geolocation.getCurrentPosition(
          (position) => {
            const geohash = generateGeohash(position.coords.latitude, position.coords.longitude, 8)
            setGeohashInput(geohash)

            // Blink yellow then set to blue
            setLocationButtonColor('yellow')
            setTimeout(() => setLocationButtonColor('blue'), 200)

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
            console.error('[Location Error]', {
              code: error.code,
              message: error.message,
              type: error.code === 1 ? 'PERMISSION_DENIED' :
                    error.code === 2 ? 'POSITION_UNAVAILABLE' :
                    error.code === 3 ? 'TIMEOUT' : 'UNKNOWN'
            })

            setIsQueryingLocation(false)
            setLocationButtonColor('red')  // Red on error

            // Show user-friendly error
            let errorMsg = 'Location error: '
            if (error.code === 1) {
              errorMsg += 'Permission denied. Please enable location access.'
            } else if (error.code === 2) {
              errorMsg += 'Position unavailable. Please ensure location services are enabled.'
            } else if (error.code === 3) {
              errorMsg += 'Request timed out. Please try again.'
            } else {
              errorMsg += error.message
            }
            toast({
              title: 'Location Error',
              description: errorMsg,
              status: 'error',
              duration: 5000,
              isClosable: true,
            })
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        )

        // Watch for position changes
        const watchId = geolocation.watchPosition(
          (position) => {
            const geohash = generateGeohash(position.coords.latitude, position.coords.longitude, 8)
            setGeohashInput(geohash)

            // Blink yellow then back to blue for updates
            setLocationButtonColor('yellow')
            setTimeout(() => setLocationButtonColor('blue'), 200)

            // Don't focus map on subsequent updates
          },
          (error) => {
            console.error('[Location Watch Error]', {
              code: error.code,
              message: error.message,
              type: error.code === 1 ? 'PERMISSION_DENIED' :
                    error.code === 2 ? 'POSITION_UNAVAILABLE' :
                    error.code === 3 ? 'TIMEOUT' : 'UNKNOWN'
            })
            setLocationButtonColor('red')  // Red on watch error
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        )

        watchIdRef.current = watchId
        console.log('[MapComponent] Started watching with watchId:', watchId)
      } else {
        console.error('[Location Error] Geolocation not supported by browser')
        setLocationButtonColor('red')
        toast({
          title: 'Not Supported',
          description: 'Geolocation is not supported by your browser',
          status: 'error',
          duration: 5000,
          isClosable: true,
        })
      }
    }
  }

  // Clean up location watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        const geolocation = getGeolocationImplementation()
        geolocation.clearWatch(watchIdRef.current)
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

  const handleStatusChange = (status: { type: 'sending' | 'sent' | 'error' | 'waiting', count?: number, message?: string }) => {
    setShareStatus(status)

    // Flash yellow on sent
    if (status.type === 'sent') {
      setTimeout(() => {
        setShareStatus(prev => prev?.type === 'sent' ? status : prev)
      }, 200)
    }
  }

  const getStatusBadge = () => {
    if (!shareStatus) return null

    let colorScheme = 'green'
    let text = ''

    switch (shareStatus.type) {
      case 'waiting':
        colorScheme = 'blue'
        text = 'Signing...'
        break
      case 'sending':
        colorScheme = 'yellow'
        text = 'Sending...'
        break
      case 'sent':
        colorScheme = 'green'
        text = shareStatus.count ? `Sent: ${shareStatus.count}` : 'Sent'
        break
      case 'error':
        colorScheme = 'red'
        text = shareStatus.message || 'Error'
        break
    }

    return (
      <Badge colorScheme={colorScheme} fontSize="xs" px={2}>
        {text}
      </Badge>
    )
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
        bottom="4"
        left="4"
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
              colorScheme={locationButtonColor}
              variant={isQueryingLocation ? 'solid' : 'outline'}
            />
          </Tooltip>
          {getStatusBadge()}
        </HStack>
      </Box>

      {/* Share Location Popup */}
      <ShareLocationPopup
        isOpen={showShareModal}
        onClose={() => {
          setShowShareModal(false)
          setShareStatus(null)
        }}
        initialGeohash={geohashInput}
        onStatusChange={handleStatusChange}
      />
    </Box>
  )
}