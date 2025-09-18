import { useEffect, useRef } from 'react'
import { Box } from '@chakra-ui/react'
import L from 'leaflet'

interface Location {
  id: string
  lat: number
  lng: number
  name: string
}

interface MapComponentProps {
  locations?: Location[]
}

export function MapComponent({ locations = [] }: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!mapRef.current || !locations.length) return

    // Add markers for locations
    locations.forEach(location => {
      L.marker([location.lat, location.lng])
        .addTo(mapRef.current!)
        .bindPopup(location.name)
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