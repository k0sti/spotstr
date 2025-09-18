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

  it('renders map without props', () => {
    render(<MapComponent />)
    // Map implementation will handle marker display from mapService
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })
})