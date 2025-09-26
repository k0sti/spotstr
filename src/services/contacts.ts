import { BehaviorSubject } from 'rxjs'
import * as nip19 from 'nostr-tools/nip19'
import { fetchProfile } from '../utils/profileRelays'

export interface Contact {
  id: string // npub
  npub: string
  pubkey: string // hex pubkey
  customName?: string
  metadata?: {
    name?: string
    display_name?: string
    picture?: string
    about?: string
    [key: string]: any
  }
  createdAt: number
}

class ContactsManager {
  private STORAGE_KEY = 'spotstr_contacts'
  public contacts$ = new BehaviorSubject<Contact[]>([])

  constructor() {
    this.loadContacts()
    // Refresh profiles for existing contacts on startup
    this.refreshAllProfiles()
  }

  private loadContacts() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const contacts = JSON.parse(stored) as Contact[]
        this.contacts$.next(contacts)
      }
    } catch (error) {
      console.error('Failed to load contacts:', error)
    }
  }

  private saveContacts() {
    const contacts = this.contacts$.value
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(contacts))
  }

  public async addContact(npubOrHex: string, customName?: string): Promise<Contact | null> {
    try {
      let npub: string
      let pubkey: string

      // Check if it's already an npub or needs encoding
      if (npubOrHex.startsWith('npub')) {
        npub = npubOrHex
        const decoded = nip19.decode(npub)
        if (decoded.type !== 'npub') {
          console.error('Invalid npub')
          return null
        }
        pubkey = decoded.data as string
      } else {
        // Assume it's a hex pubkey
        pubkey = npubOrHex
        npub = nip19.npubEncode(pubkey)
      }

      // Check if contact already exists
      const existingContacts = this.contacts$.value
      if (existingContacts.some(c => c.npub === npub)) {
        return null // Contact already exists
      }

      const contact: Contact = {
        id: npub,
        npub,
        pubkey,
        customName,
        createdAt: Date.now()
      }

      // Add contact immediately
      this.contacts$.next([...existingContacts, contact])
      this.saveContacts()

      // Fetch profile metadata asynchronously
      this.fetchAndUpdateProfile(npub, pubkey)

      return contact
    } catch (error) {
      console.error('Failed to add contact:', error)
      return null
    }
  }

  private async fetchAndUpdateProfile(npub: string, pubkey: string) {
    try {
      const profile = await fetchProfile(pubkey)
      if (profile) {
        this.updateContact(npub, { metadata: profile })
      }
    } catch (error) {
      console.error('Failed to fetch profile for contact:', error)
    }
  }

  public async refreshAllProfiles() {
    const contacts = this.contacts$.value
    for (const contact of contacts) {
      // Only refresh if no metadata or missing profile picture
      if (!contact.metadata || !contact.metadata.picture) {
        await this.fetchAndUpdateProfile(contact.npub, contact.pubkey)
      }
    }
  }

  public async addMultipleContacts(npubList: string[]): Promise<{ added: Contact[], failed: string[] }> {
    const added: Contact[] = []
    const failed: string[] = []

    for (const npub of npubList) {
      const trimmed = npub.trim()
      if (!trimmed) continue

      const contact = await this.addContact(trimmed)
      if (contact) {
        added.push(contact)
      } else {
        failed.push(trimmed)
      }
    }

    return { added, failed }
  }

  public deleteContact(id: string) {
    const currentContacts = this.contacts$.value
    const updatedContacts = currentContacts.filter(c => c.id !== id)
    this.contacts$.next(updatedContacts)
    this.saveContacts()
  }

  public updateContact(id: string, updates: Partial<Contact>) {
    const currentContacts = this.contacts$.value
    const updatedContacts = currentContacts.map(c =>
      c.id === id ? { ...c, ...updates } : c
    )
    this.contacts$.next(updatedContacts)
    this.saveContacts()
  }

  public getContact(id: string): Contact | undefined {
    return this.contacts$.value.find(c => c.id === id)
  }

  public updateCustomName(id: string, customName: string) {
    this.updateContact(id, { customName: customName || undefined })
  }
}

export const contactsManager = new ContactsManager()