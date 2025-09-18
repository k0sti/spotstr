import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LocationsPage } from './LocationsPage'

describe('LocationsPage', () => {
  it('renders create new location button', () => {
    render(<LocationsPage />)
    expect(screen.getByText(/create new/i)).toBeInTheDocument()
  })

  it('displays locations table with required columns', () => {
    render(<LocationsPage />)
    expect(screen.getByText(/name/i)).toBeInTheDocument()
    expect(screen.getByText(/event id/i)).toBeInTheDocument()
    expect(screen.getByText(/created at/i)).toBeInTheDocument()
    expect(screen.getByText(/sender/i)).toBeInTheDocument()
    expect(screen.getByText(/receiver/i)).toBeInTheDocument()
  })

  it('opens create location popup with geohash options', () => {
    render(<LocationsPage />)
    const createButton = screen.getByText(/create new/i)
    fireEvent.click(createButton)
    
    expect(screen.getByLabelText(/geohash/i)).toBeInTheDocument()
    expect(screen.getByText(/query device location/i)).toBeInTheDocument()
    expect(screen.getByText(/continuous update/i)).toBeInTheDocument()
  })

  it('shows sender and receiver selection in popup', () => {
    render(<LocationsPage />)
    const createButton = screen.getByText(/create new/i)
    fireEvent.click(createButton)
    
    expect(screen.getByLabelText(/sender/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/receiver/i)).toBeInTheDocument()
  })
})