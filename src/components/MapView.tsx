import { useEffect, useRef, useState, useCallback } from 'react'
import { Box, useColorMode, useToast, VStack, Text, HStack, Badge, Input } from '@chakra-ui/react'
import L from 'leaflet'
import { mapService, MapLocation } from '../services/mapService'
import { generateGeohash, decodeGeohash } from '../utils/crypto'
import { LocationService } from '../services/locationService'
import { ShareLocationPopup } from './ShareLocationPopup'
import { calculateGeohashCoverage, getGeohashBounds, calculateMapAreaSize, calculateGeohashSize } from '../utils/geohashCoverage'

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
const whiteGlowIcon = createMarkerIcon('#ffffff', true) // White with glow for new/updated

// Helper function to create detailed popup content
const createPopupContent = (location: MapLocation): string => {
  const event = location.event
  const isPublic = event.eventKind === 30472
  const isPrivate = event.eventKind === 30473
  const isLocationEvent = isPublic || isPrivate

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
        ${isLocationEvent ? `
          <span style="
            background: ${isPublic ? '#3b82f6' : '#dc2626'};
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            margin-right: 4px;
          ">${isPublic ? 'Public' : 'Private'}</span>
        ` : `
          <span style="
            background: #6366f1;
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            margin-right: 4px;
          ">Kind ${event.eventKind}</span>
        `}
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
  const coverageRectanglesRef = useRef<L.Rectangle[]>([])
  const isFirstLocationUpdateRef = useRef<boolean>(true)
  const [mapCenter, setMapCenter] = useState<{ lat: number, lng: number } | null>(null)
  const [mapZoom, setMapZoom] = useState<number>(2)
  const [coverageGeohashes, setCoverageGeohashes] = useState<string[]>([])
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [coverageRatio, setCoverageRatio] = useState<number>(2)
  const [currentPrecision, setCurrentPrecision] = useState<number>(1)
  const { colorMode } = useColorMode()
  const toast = useToast()
  const previousLocationsMap = useRef<Map<string, { timestamp: number, geohash: string }>>(new Map())

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

  // Update coverage rectangles for debug visualization
  const updateCoverageRectangles = useCallback((geohashes: string[]) => {
    if (!mapRef.current) return

    // Clear existing rectangles
    coverageRectanglesRef.current.forEach(rect => rect.remove())
    coverageRectanglesRef.current = []

    // Draw new rectangles
    geohashes.forEach(gh => {
      const bounds = getGeohashBounds(gh)
      if (bounds) {
        const rect = L.rectangle(bounds, {
          color: '#ff00ff',
          weight: 2,
          opacity: 0.5,
          fillOpacity: 0.1,
          dashArray: '5, 5'
        }).addTo(mapRef.current!)

        // Add label with geohash
        rect.bindTooltip(gh, {
          permanent: true,
          direction: 'center',
          className: 'geohash-label'
        })

        coverageRectanglesRef.current.push(rect)
      }
    })
  }, [])

  // Listen for debug settings changes
  useEffect(() => {
    const handleDebugSettingsChange = () => {
      const debugEnabled = localStorage.getItem('spotstr_showDebugInfo') === 'true'
      setShowDebugInfo(debugEnabled)

      if (!debugEnabled) {
        // Clear coverage rectangles
        coverageRectanglesRef.current.forEach(rect => rect.remove())
        coverageRectanglesRef.current = []
      } else if (mapRef.current) {
        // Update coverage rectangles
        updateCoverageRectangles(coverageGeohashes)
      }
    }

    window.addEventListener('debug-settings-changed', handleDebugSettingsChange)

    // Check initial state
    handleDebugSettingsChange()

    return () => {
      window.removeEventListener('debug-settings-changed', handleDebugSettingsChange)
    }
  }, [coverageGeohashes, updateCoverageRectangles])

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([30, 0], 2)

    // Add tile layer with more colorful default tiles
    const tileUrl = colorMode === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' // Standard OSM with colors

    const tileOptions = {
      attribution: colorMode === 'dark'
        ? '© OpenStreetMap contributors © CARTO'
        : '© OpenStreetMap contributors',
      maxZoom: 20,
      ...(colorMode === 'dark' ? { subdomains: 'abcd' } : { subdomains: 'abc' })
    }

    tileLayerRef.current = L.tileLayer(tileUrl, tileOptions).addTo(map)

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

  // Setup map event listeners (separate from map initialization)
  useEffect(() => {
    if (!mapRef.current) return

    // Track map movement and zoom
    const updateMapInfo = () => {
      if (!mapRef.current) return
      const center = mapRef.current.getCenter()
      const zoom = mapRef.current.getZoom()
      const bounds = mapRef.current.getBounds()

      setMapCenter({ lat: center.lat, lng: center.lng })
      setMapZoom(zoom)

      // Calculate coverage geohashes with error handling
      try {
        const coverage = calculateGeohashCoverage(bounds, coverageRatio)
        setCoverageGeohashes(coverage.coveringGeohashes)
        setCurrentPrecision(coverage.precision)

        // Update coverage rectangles if debug mode is on
        if (localStorage.getItem('spotstr_showDebugInfo') === 'true') {
          updateCoverageRectangles(coverage.coveringGeohashes)
        }
      } catch (error) {
        console.error('[MapView] Error calculating geohash coverage:', error)
        setCoverageGeohashes([])
      }
    }

    mapRef.current.on('moveend', updateMapInfo)
    mapRef.current.on('zoomend', updateMapInfo)

    // Initial update
    updateMapInfo()

    return () => {
      if (mapRef.current) {
        mapRef.current.off('moveend', updateMapInfo)
        mapRef.current.off('zoomend', updateMapInfo)
      }
    }
  }, [coverageRatio, updateCoverageRectangles])

  // Update map tiles when color mode changes
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return

    const tileUrl = colorMode === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' // Standard OSM with colors

    const tileOptions = {
      attribution: colorMode === 'dark'
        ? '© OpenStreetMap contributors © CARTO'
        : '© OpenStreetMap contributors',
      maxZoom: 20,
      ...(colorMode === 'dark' ? { subdomains: 'abcd' } : { subdomains: 'abc' })
    }

    // Remove old layer and add new one
    mapRef.current.removeLayer(tileLayerRef.current)
    tileLayerRef.current = L.tileLayer(tileUrl, tileOptions).addTo(mapRef.current)
  }, [colorMode])

  // Recalculate coverage when ratio changes
  useEffect(() => {
    if (!mapRef.current) return

    const map = mapRef.current
    const bounds = map.getBounds()
    const coverage = calculateGeohashCoverage(bounds, coverageRatio)
    setCoverageGeohashes(coverage.coveringGeohashes)
    setCurrentPrecision(coverage.precision)

    // Update coverage rectangles if debug mode is on
    if (localStorage.getItem('spotstr_showDebugInfo') === 'true') {
      updateCoverageRectangles(coverage.coveringGeohashes)
    }
  }, [coverageRatio, updateCoverageRectangles])

  // Subscribe to location updates from mapService
  useEffect(() => {
    const subscription = mapService.locations$.subscribe(setLocations)
    return () => subscription.unsubscribe()
  }, [])

  // Update map when locations change
  useEffect(() => {
    if (!mapRef.current) return

    // Create sets for efficient lookups
    const currentLocationIds = new Set(locations.map(l => l.id))
    const existingLocationIds = new Set(rectanglesRef.current.keys())

    // Identify locations to remove, add, and update
    const toRemove = new Set<string>()
    const toAdd = new Set<string>()
    const toUpdate = new Set<string>()

    // Find locations to remove (no longer in current locations)
    existingLocationIds.forEach(id => {
      if (!currentLocationIds.has(id)) {
        toRemove.add(id)
      }
    })

    // Find locations to add or update
    locations.forEach(location => {
      const previousData = previousLocationsMap.current.get(location.id)

      if (!existingLocationIds.has(location.id)) {
        // New location
        toAdd.add(location.id)
      } else if (previousData &&
                 (previousData.timestamp !== location.event.created_at ||
                  previousData.geohash !== location.event.geohash)) {
        // Updated location
        toUpdate.add(location.id)
      }
    })

    // Get current map bounds for viewport filtering
    const mapBounds = mapRef.current.getBounds()

    // Remove markers for deleted locations
    toRemove.forEach(id => {
      const rect = rectanglesRef.current.get(id)
      if (rect) {
        rect.remove()
        if ((rect as any)._associatedMarker) {
          (rect as any)._associatedMarker.remove()
        }
        if ((rect as any)._associatedCircle) {
          (rect as any)._associatedCircle.remove()
        }
        rectanglesRef.current.delete(id)
      }
      markersRef.current.delete(id)
    })

    // Update existing markers that changed
    toUpdate.forEach(id => {
      const location = locations.find(l => l.id === id)
      if (!location) return

      const rect = rectanglesRef.current.get(id)
      const marker = markersRef.current.get(id)

      if (rect && marker) {
        // Check if popup is open
        const isPopupOpen = marker.isPopupOpen()

        // Update popup content without recreating the marker
        marker.setPopupContent(createPopupContent(location))

        // Check if geohash changed (position changed)
        const decoded = decodeGeohash(location.event.geohash)
        if (decoded) {
          const newLatLng = L.latLng(decoded.lat, decoded.lng)
          const currentLatLng = marker.getLatLng()

          // Only recreate if position actually changed
          if (currentLatLng.lat !== newLatLng.lat || currentLatLng.lng !== newLatLng.lng) {
            // Position changed, need to recreate
            rect.remove()
            if ((rect as any)._associatedMarker) {
              (rect as any)._associatedMarker.remove()
            }
            if ((rect as any)._associatedCircle) {
              (rect as any)._associatedCircle.remove()
            }
            rectanglesRef.current.delete(id)
            markersRef.current.delete(id)

            // Add the updated marker
            toAdd.add(id)

            // Store popup state to restore later
            if (isPopupOpen) {
              (location as any)._restorePopup = true
            }
          } else {
            // Position unchanged, just flash the marker to show update
            const isPublic = location.event.eventKind === 30472
            const isPrivate = location.event.eventKind === 30473

            // Flash with white glow briefly
            marker.setIcon(whiteGlowIcon)
            setTimeout(() => {
              if (isPublic) {
                marker.setIcon(publicIcon)
              } else if (isPrivate) {
                marker.setIcon(privateIcon)
              } else {
                marker.setIcon(createMarkerIcon('#9333ea', false))
              }
            }, 200)

            // Keep popup open if it was open
            if (isPopupOpen) {
              marker.openPopup()
            }
          }
        }
      }
    })

    // Add new markers and updated markers
    const locationsToAdd = locations.filter(l => toAdd.has(l.id) || toUpdate.has(l.id))
    locationsToAdd.forEach(location => {
      // Viewport filtering: only show markers in current view
      if (!mapBounds.contains([location.lat, location.lng])) {
        return // Skip markers outside viewport
      }

      const decoded = decodeGeohash(location.event.geohash)
      if (!decoded) return

      // Create rectangle for geohash bounds
      const geohashBounds: L.LatLngBoundsExpression = [
        [decoded.bounds.minLat, decoded.bounds.minLng],
        [decoded.bounds.maxLat, decoded.bounds.maxLng]
      ]

      const isPublic = location.event.eventKind === 30472
      const isPrivate = location.event.eventKind === 30473
      const isNewOrUpdated = toAdd.has(location.id) || toUpdate.has(location.id)

      // Choose color based on event kind
      let rectColor: string
      let defaultIcon: L.DivIcon
      if (isPublic) {
        rectColor = '#2563eb' // blue for public location events
        defaultIcon = publicIcon
      } else if (isPrivate) {
        rectColor = '#dc2626' // red for private location events
        defaultIcon = privateIcon
      } else {
        rectColor = '#9333ea' // purple for other event kinds
        defaultIcon = createMarkerIcon('#9333ea', false)
      }

      const rect = L.rectangle(geohashBounds, {
        color: rectColor,
        weight: 1,
        opacity: 0.6,
        fillOpacity: 0.2
      }).addTo(mapRef.current!)

      // Create center marker - start with white glow if new or updated
      const marker = L.marker([decoded.lat, decoded.lng], {
        icon: isNewOrUpdated ? whiteGlowIcon : defaultIcon
      }).addTo(mapRef.current!)

      // Add detailed popup
      marker.bindPopup(createPopupContent(location))

      // Animate from white to default color if new or updated location
      if (isNewOrUpdated) {
        setTimeout(() => {
          if (marker) {
            marker.setIcon(defaultIcon)
          }
        }, 200)
      }

      // Restore popup if it was open before update
      if ((location as any)._restorePopup) {
        marker.openPopup()
        delete (location as any)._restorePopup
      }

      // Add accuracy circle if accuracy is available
      let accuracyCircle = null
      const accuracy = location.event.tags?.accuracy
      if (accuracy && typeof accuracy === 'number' && accuracy > 0) {
        let circleColor: string
        if (isPublic) {
          circleColor = '#3b82f6' // blue-500 for public
        } else if (isPrivate) {
          circleColor = '#ef4444' // red-500 for private
        } else {
          circleColor = '#a855f7' // purple-500 for other kinds
        }
        accuracyCircle = L.circle([decoded.lat, decoded.lng], {
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

      // Store marker and accuracy circle with rectangle so they're removed together
      ;(rect as any)._associatedMarker = marker
      if (accuracyCircle) {
        ;(rect as any)._associatedCircle = accuracyCircle
      }
    })

    // Update previous locations map for next comparison
    previousLocationsMap.current.clear()
    locations.forEach(location => {
      previousLocationsMap.current.set(location.id, {
        timestamp: location.event.created_at,
        geohash: location.event.geohash
      })
    })
  }, [locations])

  // Handle geohash input changes - display user's current location
  useEffect(() => {
    if (!mapRef.current) return

    // If GPS tracking is disabled, remove user location markers
    if (!isQueryingLocation) {
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove()
        userLocationMarkerRef.current = null
      }
      if (userLocationCenterRef.current) {
        userLocationCenterRef.current.remove()
        userLocationCenterRef.current = null
      }
      // Reset first location flag when stopping
      isFirstLocationUpdateRef.current = true
      return
    }

    if (geohashInput && geohashInput.length >= 1) {
      const decoded = decodeGeohash(geohashInput)
      if (decoded) {
        // Check if popup was open before updating
        const wasPopupOpen = userLocationCenterRef.current?.isPopupOpen() || false

        // Check if we need to update position
        const needsUpdate = !userLocationCenterRef.current ||
          userLocationCenterRef.current.getLatLng().lat !== decoded.lat ||
          userLocationCenterRef.current.getLatLng().lng !== decoded.lng

        if (!needsUpdate) {
          // Just update popup content if position unchanged
          if (userLocationCenterRef.current) {
            userLocationCenterRef.current.setPopupContent(`
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

            // Keep popup open if it was open
            if (wasPopupOpen) {
              userLocationCenterRef.current.openPopup()
            }
          }
          return
        }

        // Remove previous user location marker only if position changed
        if (userLocationMarkerRef.current) {
          userLocationMarkerRef.current.remove()
          userLocationMarkerRef.current = null
        }
        if (userLocationCenterRef.current) {
          userLocationCenterRef.current.remove()
          userLocationCenterRef.current = null
        }

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

        // Focus map on this location only if explicitly requested (user manually typed/submitted)
        if (shouldFocusGeohash) {
          // Fit the map to show the entire geohash rectangle with some padding
          mapRef.current.fitBounds(bounds, {
            animate: true,
            duration: 0.5,
            padding: [50, 50]
          })

          // Don't auto-open popup - let user open it manually
        } else if (wasPopupOpen && userLocationCenterRef.current) {
          // Keep popup open if it was open before the update
          userLocationCenterRef.current.openPopup()
        }
      }
    }
  }, [geohashInput, isQueryingLocation, shouldFocusGeohash, toast])

  // Create a stable callback for location updates
  const handleLocationUpdate = useCallback((position: any) => {
    if (position) {
      const geohash = generateGeohash(
        position.coords.latitude,
        position.coords.longitude,
        8
      )
      onLocationUpdate(geohash)

      // Center map on current location only on first update when 'Get current location' is enabled
      // Zoom to level 16 which shows a good neighborhood-level view
      if (mapRef.current && isFirstLocationUpdateRef.current && isQueryingLocation) {
        mapRef.current.setView(
          [position.coords.latitude, position.coords.longitude],
          16,
          {
            animate: true,
            duration: 0.5
          }
        )

        isFirstLocationUpdateRef.current = false
      }
    }
  }, [onLocationUpdate, isQueryingLocation])

  // Handle location tracking
  useEffect(() => {
    if (isQueryingLocation) {
      // Only reset the flag if we're truly starting fresh (not from continuous sharing)
      if (!watchIdRef.current) {
        isFirstLocationUpdateRef.current = true
      }
      LocationService.startWatching(handleLocationUpdate)
      watchIdRef.current = 'watching'
    } else {
      if (watchIdRef.current) {
        LocationService.stopWatching(handleLocationUpdate)
        watchIdRef.current = null
      }
    }

    return () => {
      if (watchIdRef.current) {
        LocationService.stopWatching(handleLocationUpdate)
        watchIdRef.current = null
      }
    }
  }, [isQueryingLocation, handleLocationUpdate])

  // Handle focus events from mapService
  useEffect(() => {
    const subscription = mapService.focusLocation$.subscribe(focusData => {
      if (!focusData.id || !mapRef.current) return

      const marker = markersRef.current.get(focusData.id)
      const rect = rectanglesRef.current.get(focusData.id)
      if (marker && rect) {
        const location = locations.find(l => l.id === focusData.id)
        if (!location) return

        // Use provided options or calculate defaults
        if (focusData.options?.fitBounds && focusData.options?.zoomLevel) {
          // When clicking from location list, fit to geohash bounds with specified zoom
          const bounds = L.latLngBounds(
            [location.bounds.minLat, location.bounds.minLng],
            [location.bounds.maxLat, location.bounds.maxLng]
          )
          mapRef.current.fitBounds(bounds, {
            animate: true,
            duration: 0.5,
            maxZoom: focusData.options.zoomLevel,
            padding: [50, 50]
          })
        } else {
          // When clicking on marker, just pan without changing zoom
          const latLng = marker.getLatLng()
          mapRef.current.setView(latLng, mapRef.current.getZoom(), {
            animate: true,
            duration: 0.5
          })
        }

        // Find the location to get its type for default color
        const isPublic = location.event.eventKind === 30472
        const isPrivate = location.event.eventKind === 30473
        let defaultColor = '#9333ea' // purple for other kinds
        if (isPublic) defaultColor = '#2563eb' // blue
        else if (isPrivate) defaultColor = '#dc2626' // red

        // Highlight the focused rectangle
        rect.setStyle({ color: '#fbbf24', weight: 3 }) // yellow highlight
        setTimeout(() => {
          rect.setStyle({ color: defaultColor, weight: 1 })
        }, 2000)

        marker.openPopup()
      }
    })

    return () => subscription.unsubscribe()
  }, [locations])

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

      {/* Debug Info Panel */}
      {showDebugInfo && mapCenter && (
        <Box
          position="fixed"
          top="80px"
          left="10px"
          bg="white"
          border="1px solid"
          borderColor="gray.300"
          borderRadius="md"
          p={3}
          shadow="md"
          zIndex={1000}
          fontSize="sm"
          fontFamily="mono"
          minW="200px"
        >
          <VStack align="start" spacing={1}>
            <Text fontWeight="bold" color="blue.600">Geohash Coverage</Text>
            <HStack spacing={2}>
              <Text>Zoom:</Text>
              <Badge colorScheme="blue">{mapZoom.toFixed(1)}</Badge>
            </HStack>
            <VStack align="start" spacing={1}>
              <Text fontSize="xs">Coverage ratio:</Text>
              <Input
                size="xs"
                width="80px"
                defaultValue={coverageRatio}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = parseFloat(e.currentTarget.value)
                    if (!isNaN(value) && value > 0) {
                      setCoverageRatio(value)
                    }
                  }
                }}
                onBlur={(e) => {
                  const value = parseFloat(e.target.value)
                  if (!isNaN(value) && value > 0) {
                    setCoverageRatio(value)
                  }
                }}
                fontSize="xs"
                type="number"
                step="0.05"
              />
            </VStack>
            {mapCenter && mapRef.current && (
              <VStack align="start" spacing={1}>
                <Text fontSize="xs" fontWeight="bold" color="orange.600">Size Analysis:</Text>
                <VStack align="start" spacing={0}>
                  <Text fontSize="xs">
                    Map area: {(() => {
                      const bounds = mapRef.current!.getBounds()
                      const area = calculateMapAreaSize(bounds)
                      return `${area.latSize.toFixed(4)}° x ${area.lngSize.toFixed(4)}°`
                    })()}
                  </Text>
                  <Text fontSize="xs">
                    Geohash size (p{currentPrecision}): {(() => {
                      const geohashArea = calculateGeohashSize(currentPrecision)
                      return `${geohashArea.latSize.toFixed(4)}° x ${geohashArea.lngSize.toFixed(4)}°`
                    })()}
                  </Text>
                  <Text fontSize="xs">
                    Ratio: {(() => {
                      const bounds = mapRef.current!.getBounds()
                      const mapArea = calculateMapAreaSize(bounds)
                      const geohashArea = calculateGeohashSize(currentPrecision)
                      return `${(geohashArea.maxSize / mapArea.maxSize).toFixed(3)}`
                    })()}
                  </Text>
                </VStack>
              </VStack>
            )}
            <VStack align="start" spacing={1}>
              <Text>Coverage ({coverageGeohashes.length}):</Text>
              <Box
                display="flex"
                flexWrap="wrap"
                gap={1}
                maxW="200px"
              >
                {coverageGeohashes.map((gh, i) => (
                  <Text
                    key={i}
                    fontSize="xs"
                    color="purple.600"
                    fontFamily="mono"
                    bg="purple.50"
                    px={1}
                    borderRadius="sm"
                    whiteSpace="nowrap"
                  >
                    {gh}
                  </Text>
                ))}
              </Box>
            </VStack>
            <Text fontSize="xs" color="gray.500">
              Markers: {locations.length} total
            </Text>
          </VStack>
        </Box>
      )}

      <ShareLocationPopup
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        initialGeohash={geohashInput}
      />
    </>
  )
}