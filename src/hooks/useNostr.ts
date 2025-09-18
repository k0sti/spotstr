import { useState, useEffect } from 'react'
import { Observable, BehaviorSubject } from 'rxjs'
import { SimplePool } from 'nostr-tools/pool'
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure'
import * as nip19 from 'nostr-tools/nip19'
import * as nip44 from 'nostr-tools/nip44'
import { LocationEvent, Identity } from '../types'
import { mapService } from '../services/mapService'

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


  // Location events - handle addressable events deduplication
  addLocationEvent(event: LocationEvent) {
    const current = this.locationEvents$.value
    
    // For addressable events (30000-39999), deduplicate by kind, pubkey, and d-tag
    // Since kind is 30473, we need to check for existing events with same sender and d-tag
    const addressableKey = `${event.senderNpub}:${event.dTag || ''}`
    
    // Remove any existing event with the same addressable key
    const filtered = current.filter(e => {
      const existingKey = `${e.senderNpub}:${e.dTag || ''}`
      return existingKey !== addressableKey
    })
    
    // Add the new event (it replaces any older version)
    const updated = [...filtered, event]
    
    // Sort by created_at descending to show newest first
    updated.sort((a, b) => b.created_at - a.created_at)
    
    this.locationEvents$.next(updated)
    this.saveToStorage('locationEvents', updated)
    
    // Update map service with new locations
    mapService.updateLocations(updated)
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
      await Promise.allSettled(
        this.pool.publish(relayUrls, signedEvent)
      )

      console.log('Published event:', signedEvent)
      return signedEvent
    } catch (error) {
      console.error('Failed to publish event:', error)
      throw error
    }
  }

  private async processLocationEvent(event: any) {
    // Process incoming location event (NIP-location addressable events)
    // Kind 30473 is an addressable event, deduplicated by pubkey + d-tag
    
    const senderNpub = event.pubkey ? nip19.npubEncode(event.pubkey) : ''
    const dTag = event.tags?.find((t: any) => t[0] === 'd')?.[1] || ''
    const recipientPubkey = event.tags?.find((t: any) => t[0] === 'p')?.[1]
    const recipientNpub = recipientPubkey ? nip19.npubEncode(recipientPubkey) : ''
    
    // Create unique ID based on addressable event properties
    const addressableId = `30473:${event.pubkey}:${dTag}`
    
    let decryptedGeohash = 'encrypted'
    let accuracy: number | undefined
    
    // Try to decrypt if we have the recipient's private key
    if (recipientPubkey && event.content) {
      const identities = this.identities$.value
      const recipientIdentity = identities.find(id => {
        if (!id.nsec) return false
        try {
          const decoded = nip19.decode(id.nsec)
          if (decoded.type === 'nsec') {
            const pubkey = getPublicKey(decoded.data as Uint8Array)
            return pubkey === recipientPubkey
          }
        } catch {}
        return false
      })
      
      if (recipientIdentity && recipientIdentity.nsec) {
        try {
          // Decrypt using NIP-44
          const decoded = nip19.decode(recipientIdentity.nsec)
          if (decoded.type === 'nsec') {
            const secretKey = decoded.data as Uint8Array
            const conversationKey = nip44.v2.utils.getConversationKey(
              secretKey,
              event.pubkey
            )
            
            const decryptedContent = nip44.v2.decrypt(
              event.content,
              conversationKey
            )
            
            // Parse the decrypted JSON array of tags
            const contentTags = JSON.parse(decryptedContent) as Array<[string, string]>
            const gTag = contentTags.find(t => t[0] === 'g')
            const accuracyTag = contentTags.find(t => t[0] === 'accuracy')
            
            if (gTag && gTag[1]) {
              decryptedGeohash = gTag[1]
              console.log('Decrypted geohash:', decryptedGeohash)
            }
            
            if (accuracyTag && accuracyTag[1]) {
              accuracy = parseInt(accuracyTag[1])
            }
          }
        } catch (error) {
          console.error('Failed to decrypt location event:', error)
        }
      }
    }
    
    const locationEvent: LocationEvent = {
      id: addressableId,
      eventId: event.id,
      created_at: event.created_at,
      senderNpub,
      receiverNpub: recipientNpub,
      dTag,
      geohash: decryptedGeohash,
      accuracy,
      expiry: event.tags?.find((t: any) => t[0] === 'expiration')?.[1],
      name: dTag || undefined,
    }
    
    this.addLocationEvent(locationEvent)
    
    // Update map service with all location events
    mapService.updateLocations(this.locationEvents$.value)
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