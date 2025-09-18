import { useEffect, useRef, useState } from 'react'
import { Box } from '@chakra-ui/react'
import L from 'leaflet'
import { mapService, MapLocation } from '../services/mapService'

export function MapComponent() {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const rectanglesRef = useRef<Map<string, L.Rectangle>>(new Map())
  const [locations, setLocations] = useState<MapLocation[]>([])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    // Initialize Leaflet map
    mapRef.current = L.map(mapContainerRef.current).setView([51.505, -0.09], 13)

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
        mapRef.current.setView([location.lat, location.lng], 15, {
          animate: true,
          duration: 0.5
        })
        
        // Highlight the focused rectangle
        const rect = rectanglesRef.current.get(location.id)
        if (rect) {
          rect.setStyle({ color: '#ff0000', weight: 3 })
          setTimeout(() => {
            rect.setStyle({ color: '#0000ff', weight: 2 })
          }, 2000)
        }
      }
    })
    return () => focusSub.unsubscribe()
  }, [])

  // Update rectangles and markers when locations change
  useEffect(() => {
    if (!mapRef.current) return

    // Clear existing rectangles and markers
    rectanglesRef.current.forEach(rect => {
      rect.remove()
      // Also remove the associated marker
      if ((rect as any)._associatedMarker) {
        (rect as any)._associatedMarker.remove()
      }
    })
    rectanglesRef.current.clear()

    // Add blue rectangles and center markers for each location
    locations.forEach(location => {
      const bounds = L.latLngBounds(
        [location.bounds.minLat, location.bounds.minLng],
        [location.bounds.maxLat, location.bounds.maxLng]
      )

      // Add blue rectangle for the geohash bounds
      const rectangle = L.rectangle(bounds, {
        color: '#0000ff',
        weight: 2,
        opacity: 0.8,
        fillColor: '#0000ff',
        fillOpacity: 0.2
      })
        .addTo(mapRef.current!)

      // Add marker at the center of the location
      const marker = L.marker([location.lat, location.lng])
        .addTo(mapRef.current!)
        .bindPopup(`
          <div>
            <strong>${location.event.name || location.event.dTag || 'Location'}</strong><br/>
            Geohash: ${location.event.geohash}<br/>
            From: ${location.event.senderNpub.slice(0, 8)}...<br/>
            ${location.event.accuracy ? `Accuracy: ${location.event.accuracy}m` : ''}
          </div>
        `)

      // Store rectangle reference for highlighting
      rectanglesRef.current.set(location.id, rectangle)
      
      // Store marker with rectangle so they're removed together
      ;(rectangle as any)._associatedMarker = marker
    })
  }, [locations])

  return (
    <Box 
      ref={mapContainerRef}
      data-testid="map-container"
      width="100%"
      height="100vh"
    />
  )
}