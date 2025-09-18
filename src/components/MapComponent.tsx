import { useEffect, useRef, useState } from 'react'
import { Box } from '@chakra-ui/react'
import L from 'leaflet'
import { mapService, MapLocation } from '../services/mapService'

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css'

// Create a custom marker icon using a data URL to avoid build issues
const customIcon = L.divIcon({
  html: `
    <div style="
      background: #2563eb;
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

      // Add marker at the center of the location with custom icon
      const marker = L.marker([location.lat, location.lng], { icon: customIcon })
        .addTo(mapRef.current!)
        .bindPopup(`
          <div>
            <strong>${location.event.name || location.event.dTag || 'Location'}</strong><br/>
            Geohash: ${location.event.geohash}<br/>
            From: ${location.event.senderNpub.slice(0, 8)}...<br/>
            ${location.event.accuracy ? `Accuracy: ${location.event.accuracy}m` : ''}
          </div>
        `)

      // Add accuracy circle if accuracy is available
      let accuracyCircle = null
      if (location.event.accuracy && location.event.accuracy > 0) {
        accuracyCircle = L.circle([location.lat, location.lng], {
          radius: location.event.accuracy, // radius in meters
          color: '#3b82f6', // blue-500
          weight: 1,
          opacity: 0.6,
          fillColor: '#3b82f6',
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

  return (
    <Box 
      ref={mapContainerRef}
      data-testid="map-container"
      width="100%"
      height="100vh"
    />
  )
}