import { useState, useEffect } from 'react'
import { Observable, BehaviorSubject } from 'rxjs'
import { SimplePool } from 'nostr-tools/pool'
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import * as nip19 from 'nostr-tools/nip19'
import { LocationEvent, Identity } from '../types'

class NostrService {
  private pool = new SimplePool()
  private identities$ = new BehaviorSubject<Identity[]>([])
  private locationEvents$ = new BehaviorSubject<LocationEvent[]>([])
  private activeSubscriptions = new Map<string, any>()

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

  removeIdentity(id: string) {
    const current = this.identities$.value
    const updated = current.filter(i => i.id !== id)
    this.identities$.next(updated)
    this.saveToStorage('identities', updated)
  }

  getIdentities(): Observable<Identity[]> {
    return this.identities$.asObservable()
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
      const locationEvents = JSON.parse(localStorage.getItem('spotstr_locationEvents') || '[]')
      
      this.identities$.next(identities)
      this.locationEvents$.next(locationEvents)
    } catch (error) {
      console.error('Error loading from storage:', error)
    }
  }

  // Relay connection using nostr-tools
  async connectToRelay(relayUrl: string) {
    try {
      // Close existing subscriptions for this relay
      const existingSub = this.activeSubscriptions.get(relayUrl)
      if (existingSub) {
        existingSub.close()
      }

      // Subscribe to location events (kind 30473 - encrypted location events per NIP-30473)
      const sub = this.pool.subscribeMany(
        [relayUrl],
        [
          {
            kinds: [30473],
            limit: 100
          }
        ],
        {
          onevent: (event) => {
            this.processLocationEvent(event)
          },
          oneose: () => {
            console.log('End of stored events')
          },
          onerror: (err) => {
            console.error('Relay error:', err)
          }
        }
      )

      this.activeSubscriptions.set(relayUrl, sub)
      return sub
    } catch (error) {
      console.error('Failed to connect to relay:', error)
      throw error
    }
  }

  // Publish location event to relays
  async publishLocationEvent(event: any, relayUrls: string[]) {
    try {
      // Get the first identity's secret key for signing (in production, let user choose)
      const identities = this.identities$.value
      if (identities.length === 0) {
        throw new Error('No identity available for signing')
      }

      const identity = identities[0]
      if (!identity.nsec) {
        throw new Error('Identity has no secret key')
      }

      // Decode the nsec to get the secret key
      const decoded = nip19.decode(identity.nsec)
      if (decoded.type !== 'nsec') {
        throw new Error('Invalid nsec')
      }

      const secretKey = decoded.data as Uint8Array

      // Sign the event
      const signedEvent = finalizeEvent(event, secretKey)

      // Publish to relays
      const results = await Promise.allSettled(
        this.pool.publish(relayUrls, signedEvent)
      )

      console.log('Published event:', signedEvent)
      return signedEvent
    } catch (error) {
      console.error('Failed to publish event:', error)
      throw error
    }
  }

  private processLocationEvent(event: any) {
    // Process incoming location event
    // In production, would decrypt content field
    const locationEvent: LocationEvent = {
      id: crypto.randomUUID(),
      eventId: event.id,
      created_at: event.created_at,
      senderNpub: event.pubkey ? nip19.npubEncode(event.pubkey) : '',
      receiverNpub: event.tags?.find((t: any) => t[0] === 'p')?.[1] 
        ? nip19.npubEncode(event.tags.find((t: any) => t[0] === 'p')[1])
        : '',
      dTag: event.tags?.find((t: any) => t[0] === 'd')?.[1],
      geohash: 'encrypted', // Would decrypt from content in production
      expiry: event.tags?.find((t: any) => t[0] === 'expiration')?.[1],
    }
    
    this.addLocationEvent(locationEvent)
  }

  // Disconnect from relays
  disconnectAll() {
    this.activeSubscriptions.forEach((sub, url) => {
      sub.close()
      console.log(`Disconnected from ${url}`)
    })
    this.activeSubscriptions.clear()
  }
}

const nostrService = new NostrService()

export function useNostr() {
  const [identities, setIdentities] = useState<Identity[]>([])
  const [locationEvents, setLocationEvents] = useState<LocationEvent[]>([])

  useEffect(() => {
    const identitiesSub = nostrService.getIdentities().subscribe(setIdentities)
    const locationEventsSub = nostrService.getLocationEvents().subscribe(setLocationEvents)

    return () => {
      identitiesSub.unsubscribe()
      locationEventsSub.unsubscribe()
    }
  }, [])

  return {
    identities,
    locationEvents,
    addIdentity: (identity: Identity) => nostrService.addIdentity(identity),
    removeIdentity: (id: string) => nostrService.removeIdentity(id),
    addLocationEvent: (event: LocationEvent) => nostrService.addLocationEvent(event),
    connectToRelay: (url: string) => nostrService.connectToRelay(url),
    publishLocationEvent: (event: any, relayUrls: string[]) => nostrService.publishLocationEvent(event, relayUrls),
    disconnectAll: () => nostrService.disconnectAll(),
  }
}