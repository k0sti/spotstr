import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContactsPage } from './ContactsPage'

describe('ContactsPage', () => {
  it('renders add contact button', () => {
    render(<ContactsPage />)
    expect(screen.getByText(/add contact/i)).toBeInTheDocument()
  })

  it('displays contacts table with profile information', () => {
    render(<ContactsPage />)
    expect(screen.getByText(/name/i)).toBeInTheDocument()
    expect(screen.getByText(/source/i)).toBeInTheDocument()
    expect(screen.getByText(/profile/i)).toBeInTheDocument()
  })

  it('opens add contact popup with generation and paste options', () => {
    render(<ContactsPage />)
    const addButton = screen.getByText(/add contact/i)
    fireEvent.click(addButton)
    
    expect(screen.getByText(/generate new key/i)).toBeInTheDocument()
    expect(screen.getByText(/paste npub/i)).toBeInTheDocument()
  })
})