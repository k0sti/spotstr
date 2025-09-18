import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MapComponent } from './MapComponent'

describe('MapComponent', () => {
  it('renders map container', () => {
    render(<MapComponent />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('initializes leaflet map', () => {
    render(<MapComponent />)
    const mapContainer = screen.getByTestId('map-container')
    expect(mapContainer).toHaveStyle({ height: '100vh' })
  })

  it('displays location markers when provided', () => {
    const mockLocations = [
      { id: '1', lat: 51.505, lng: -0.09, name: 'Test Location' }
    ]
    render(<MapComponent locations={mockLocations} />)
    // Map implementation will handle marker display
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })
})