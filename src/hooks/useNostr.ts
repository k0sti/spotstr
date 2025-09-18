import { useState, useEffect } from 'react'
import { Observable, BehaviorSubject } from 'rxjs'
import { RelayPool } from 'applesauce-relay'
import { LocationEvent, Identity, Contact } from '../types'

class NostrService {
  private pool = new RelayPool()
  private identities$ = new BehaviorSubject<Identity[]>([])
  private contacts$ = new BehaviorSubject<Contact[]>([])
  private locationEvents$ = new BehaviorSubject<LocationEvent[]>([])

  constructor() {
    // Load from localStorage on init
    this.loadFromStorage()
  }

  // Identity management
  addIdentity(identity: Identity) {
    const current = this.identities$.value
    const updated = [...current, identity]
    this.identities$.next(updated)
    this.saveToStorage('identities', updated)
  }

  getIdentities(): Observable<Identity[]> {
    return this.identities$.asObservable()
  }

  // Contact management
  addContact(contact: Contact) {
    const current = this.contacts$.value
    const updated = [...current, contact]
    this.contacts$.next(updated)
    this.saveToStorage('contacts', updated)
  }

  getContacts(): Observable<Contact[]> {
    return this.contacts$.asObservable()
  }

  // Location events
  addLocationEvent(event: LocationEvent) {
    const current = this.locationEvents$.value
    const updated = [...current, event]
    this.locationEvents$.next(updated)
    this.saveToStorage('locationEvents', updated)
  }

  getLocationEvents(): Observable<LocationEvent[]> {
    return this.locationEvents$.asObservable()
  }

  // Storage helpers
  private saveToStorage(key: string, data: any) {
    localStorage.setItem(`spotstr_${key}`, JSON.stringify(data))
  }

  private loadFromStorage() {
    try {
      const identities = JSON.parse(localStorage.getItem('spotstr_identities') || '[]')
      const contacts = JSON.parse(localStorage.getItem('spotstr_contacts') || '[]')
      const locationEvents = JSON.parse(localStorage.getItem('spotstr_locationEvents') || '[]')
      
      this.identities$.next(identities)
      this.contacts$.next(contacts)
      this.locationEvents$.next(locationEvents)
    } catch (error) {
      console.error('Error loading from storage:', error)
    }
  }

  // Relay connection
  async connectToRelay(relayUrl: string) {
    try {
      // Connect to relay and subscribe to location events (kind 30473)
      const subscription = this.pool
        .relay(relayUrl)
        .subscription({ kinds: [30473], limit: 100 })
        .subscribe({
          next: (response) => {
            if (response !== 'EOSE' && typeof response === 'object') {
              // Process location event
              this.processLocationEvent(response)
            }
          },
          error: (err) => console.error('Relay error:', err),
        })

      return subscription
    } catch (error) {
      console.error('Failed to connect to relay:', error)
      throw error
    }
  }

  private processLocationEvent(event: any) {
    // Basic event processing - in real app would decrypt content
    const locationEvent: LocationEvent = {
      id: crypto.randomUUID(),
      eventId: event.id,
      created_at: event.created_at,
      senderNpub: event.pubkey,
      receiverNpub: event.tags?.find((t: any) => t[0] === 'p')?.[1],
      dTag: event.tags?.find((t: any) => t[0] === 'd')?.[1],
      geohash: 'temp_geohash', // Would decrypt from content
      expiry: event.tags?.find((t: any) => t[0] === 'expiration')?.[1],
    }
    
    this.addLocationEvent(locationEvent)
  }
}

const nostrService = new NostrService()

export function useNostr() {
  const [identities, setIdentities] = useState<Identity[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [locationEvents, setLocationEvents] = useState<LocationEvent[]>([])

  useEffect(() => {
    const identitiesSub = nostrService.getIdentities().subscribe(setIdentities)
    const contactsSub = nostrService.getContacts().subscribe(setContacts)
    const locationEventsSub = nostrService.getLocationEvents().subscribe(setLocationEvents)

    return () => {
      identitiesSub.unsubscribe()
      contactsSub.unsubscribe()
      locationEventsSub.unsubscribe()
    }
  }, [])

  return {
    identities,
    contacts,
    locationEvents,
    addIdentity: (identity: Identity) => nostrService.addIdentity(identity),
    addContact: (contact: Contact) => nostrService.addContact(contact),
    addLocationEvent: (event: LocationEvent) => nostrService.addLocationEvent(event),
    connectToRelay: (url: string) => nostrService.connectToRelay(url),
  }
}