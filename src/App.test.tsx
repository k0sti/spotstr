import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App'

describe('Spotstr App', () => {
  it('renders the app with Spotstr title', () => {
    render(<App />)
    expect(screen.getByText('Spotstr')).toBeInTheDocument()
  })

  it('displays the main navigation with all required pages', () => {
    render(<App />)
    
    // Check for navigation icons/buttons for all 5 pages
    expect(screen.getByLabelText(/identities/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/locations/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contacts/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/settings/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/event log/i)).toBeInTheDocument()
  })

  it('displays the map container', () => {
    render(<App />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('renders the identities page by default', () => {
    render(<App />)
    expect(screen.getByText(/create new/i)).toBeInTheDocument()
  })

  it('allows navigation between pages', () => {
    render(<App />)
    
    const locationsButton = screen.getByLabelText(/locations/i)
    expect(locationsButton).toBeInTheDocument()
    // Navigation functionality will be tested after implementation
  })
})