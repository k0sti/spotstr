import { useEffect, useRef, useState } from 'react'
import { Box, useColorMode, useToast } from '@chakra-ui/react'
import L from 'leaflet'
import { mapService, MapLocation } from '../services/mapService'
import { generateGeohash, decodeGeohash } from '../utils/crypto'
import { LocationService } from '../services/locationService'
import { ShareLocationPopup } from './ShareLocationPopup'

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css'

// Create custom marker icons
const createMarkerIcon = (color: string, glow: boolean = false) => L.divIcon({
  html: `
    <div style="
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      width: 12px;
      height: 12px;
      box-shadow: ${glow ? '0 0 12px 4px rgba(255,255,255,0.9), 0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.3)'};
    "></div>
  `,
  className: 'custom-marker',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -6]
})

const publicIcon = createMarkerIcon('#2563eb')
const privateIcon = createMarkerIcon('#dc2626')
// const whiteGlowIcon = createMarkerIcon('#ffffff', true) // Reserved for future use

// Helper function to create detailed popup content
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
        <span onclick="window.mapCopyToClipboard('${escapeHtml(event.senderNpub || '')}', 'Public key')" style="
          background: #fbbf24;
          color: #78350f;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          font-family: monospace;
          margin-left: 4px;
        " title="Click to copy">${(event.senderNpub || 'Unknown').slice(0, 8)}...</span>
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

      <!-- Expiry if present -->
      ${event.expiry ? `<div style="font-size: 12px; margin-top: 2px;">
        <strong>expires:</strong> ${new Date(event.expiry * 1000).toLocaleString()}
      </div>` : ''}

      <!-- Other tags -->
      ${otherTagsHtml}
    </div>
  `
}

export interface MapViewProps {
  geohashInput: string
  isQueryingLocation: boolean
  onLocationUpdate: (geohash: string) => void
  shouldFocusGeohash?: boolean
}

export function MapView({
  geohashInput,
  isQueryingLocation,
  onLocationUpdate,
  shouldFocusGeohash = false
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const rectanglesRef = useRef<Map<string, L.Rectangle>>(new Map())
  const [locations, setLocations] = useState<MapLocation[]>([])
  const [showShareModal, setShowShareModal] = useState(false)
  const watchIdRef = useRef<string | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const userLocationMarkerRef = useRef<L.Rectangle | null>(null)
  const userLocationCenterRef = useRef<L.Marker | null>(null)
  const { colorMode } = useColorMode()
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
  }, [toast])

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([30, 0], 2)

    // Add tile layer (light mode by default since theme.ts has initialColorMode: 'light')
    const tileUrl = colorMode === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map)

    // Zoom control removed - using touch/scroll zoom instead
    // Attribution moved to bottom right
    L.control.attribution({ position: 'bottomright' }).addTo(map)

    mapRef.current = map
    mapService.setMap(map)

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        mapService.setMap(null)
      }
    }
  }, [])

  // Update map tiles when color mode changes
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return

    const tileUrl = colorMode === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

    // Remove old layer and add new one
    mapRef.current.removeLayer(tileLayerRef.current)
    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(mapRef.current)
  }, [colorMode])

  // Subscribe to location updates from mapService
  useEffect(() => {
    const subscription = mapService.locations$.subscribe(setLocations)
    return () => subscription.unsubscribe()
  }, [])

  // Update map when locations change
  useEffect(() => {
    if (!mapRef.current) return

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current.clear()
    rectanglesRef.current.forEach(rect => rect.remove())
    rectanglesRef.current.clear()

    // Add markers for each location
    locations.forEach(location => {
      const decoded = decodeGeohash(location.event.geohash)
      if (!decoded) return

      // Create rectangle for geohash bounds
      const bounds: L.LatLngBoundsExpression = [
        [decoded.bounds.minLat, decoded.bounds.minLng],
        [decoded.bounds.maxLat, decoded.bounds.maxLng]
      ]

      const isPublic = location.event.eventKind === 30472
      const rect = L.rectangle(bounds, {
        color: isPublic ? '#2563eb' : '#dc2626',
        weight: 1,
        opacity: 0.6,
        fillOpacity: 0.2
      }).addTo(mapRef.current!)

      // Create center marker
      const marker = L.marker([decoded.lat, decoded.lng], {
        icon: isPublic ? publicIcon : privateIcon
      }).addTo(mapRef.current!)

      // Add detailed popup
      marker.bindPopup(createPopupContent(location))

      // Add accuracy circle if accuracy is available
      const accuracy = location.event.tags?.accuracy
      if (accuracy && typeof accuracy === 'number' && accuracy > 0) {
        const circleColor = isPublic ? '#3b82f6' : '#ef4444' // blue-500 for public, red-500 for private
        L.circle([decoded.lat, decoded.lng], {
          radius: accuracy, // radius in meters
          color: circleColor,
          weight: 1,
          opacity: 0.6,
          fillColor: circleColor,
          fillOpacity: 0.1
        }).addTo(mapRef.current!)
      }

      markersRef.current.set(location.id, marker)
      rectanglesRef.current.set(location.id, rect)
    })
  }, [locations])

  // Handle geohash input changes - display user's current location
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
          .bindPopup(`
            <div style="font-family: -apple-system, system-ui, sans-serif; min-width: 180px;">
              <div style="font-weight: bold; margin-bottom: 8px;">Your Location</div>
              <div style="margin-bottom: 6px;">
                <span style="
                  background: #10b981;
                  color: white;
                  padding: 2px 6px;
                  border-radius: 4px;
                  font-size: 11px;
                  font-weight: 500;
                  margin-right: 4px;
                ">Current</span>
                <span onclick="window.mapCopyToClipboard('${geohashInput}', 'Geohash')" style="
                  background: #6b7280;
                  color: white;
                  padding: 2px 6px;
                  border-radius: 4px;
                  font-size: 11px;
                  cursor: pointer;
                " title="Click to copy">${geohashInput}</span>
              </div>
              <div style="font-size: 12px; color: #6b7280;">
                Lat: ${decoded.lat.toFixed(6)}, Lng: ${decoded.lng.toFixed(6)}
              </div>
            </div>
          `)

        // Focus map on this location if user manually submitted it or typed it (not from GPS query)
        if (shouldFocusGeohash || (!isQueryingLocation && geohashInput.length > 0)) {
          // Fit the map to show the entire geohash rectangle with some padding
          mapRef.current.fitBounds(bounds, {
            animate: true,
            duration: 0.5,
            padding: [50, 50]
          })
        }
      }
    }
  }, [geohashInput, isQueryingLocation, shouldFocusGeohash, toast])

  // Handle location tracking
  useEffect(() => {
    if (isQueryingLocation) {
      LocationService.startWatching((position) => {
        if (position) {
          const geohash = generateGeohash(
            position.coords.latitude,
            position.coords.longitude,
            8
          )
          onLocationUpdate(geohash)

          // Center map on current location
          if (mapRef.current) {
            mapRef.current.setView(
              [position.coords.latitude, position.coords.longitude],
              18
            )
          }
        }
      })
      watchIdRef.current = 'watching'
    } else {
      if (watchIdRef.current) {
        LocationService.stopWatching()
        watchIdRef.current = null
      }
    }

    return () => {
      if (watchIdRef.current) {
        LocationService.stopWatching()
      }
    }
  }, [isQueryingLocation, onLocationUpdate])

  // Handle focus events from mapService
  useEffect(() => {
    const subscription = mapService.focusLocation$.subscribe(locationId => {
      if (!locationId || !mapRef.current) return

      const marker = markersRef.current.get(locationId)
      if (marker) {
        const latLng = marker.getLatLng()
        mapRef.current.setView(latLng, 18, {
          animate: true,
          duration: 0.5
        })
        marker.openPopup()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <>
      <Box
        ref={mapContainerRef}
        data-testid="map-container"
        position="fixed"
        top="0"
        left="0"
        right="0"
        bottom="0"
        width="100vw"
        height="100vh"
        style={{
          zIndex: 1
        }}
      />

      <ShareLocationPopup
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        initialGeohash={geohashInput}
      />
    </>
  )
}