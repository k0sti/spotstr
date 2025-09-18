import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IdentitiesPage } from './IdentitiesPage'

describe('IdentitiesPage', () => {
  it('renders create new button', () => {
    render(<IdentitiesPage />)
    expect(screen.getByText(/create new/i)).toBeInTheDocument()
  })

  it('displays identities table with headers', () => {
    render(<IdentitiesPage />)
    expect(screen.getByText(/name/i)).toBeInTheDocument()
    expect(screen.getByText(/source/i)).toBeInTheDocument()
    expect(screen.getByText(/keys/i)).toBeInTheDocument()
    expect(screen.getByText(/actions/i)).toBeInTheDocument()
  })

  it('opens create identity popup when create new is clicked', () => {
    render(<IdentitiesPage />)
    const createButton = screen.getByText(/create new/i)
    fireEvent.click(createButton)
    
    expect(screen.getByText(/generate new keys/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/paste existing nsec/i)).toBeInTheDocument()
    expect(screen.getByText(/sign in with extension/i)).toBeInTheDocument()
  })

  it('shows identity creation options in popup', () => {
    render(<IdentitiesPage />)
    const createButton = screen.getByText(/create new/i)
    fireEvent.click(createButton)
    
    // Three methods as per spec
    expect(screen.getByRole('button', { name: /generate new keys/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /paste nsec/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in with extension/i })).toBeInTheDocument()
  })
})