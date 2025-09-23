import { useState, useEffect, useMemo } from 'react'
import { EventStore } from 'applesauce-core'
import { Relay } from 'applesauce-relay'
import * as nip19 from 'nostr-tools/nip19'
import * as nip44 from 'nostr-tools/nip44'
import { getPublicKey } from 'nostr-tools/pure'
import { LocationEvent, Identity } from '../types'
import { mapService } from '../services/mapService'

// Initialize Applesauce EventStore
const eventStore = new EventStore()

class NostrApplesauceService {
  private identities: Identity[] = []
  private locationEvents: LocationEvent[] = []
  private connectedRelays: Map<string, Relay> = new Map()
  private updateCallbacks: Set<() => void> = new Set()
  private activeSubscriptions: Map<string, any> = new Map()

  constructor() {
    this.loadFromStorage()
    this.autoConnectToSavedRelay()
  }

  // Identity management
  async addIdentity(identity: Identity) {
    this.identities.push(identity)
    this.saveToStorage('identities', this.identities)

    if (identity.nsec) {
      await this.decryptExistingLocationsForIdentity(identity)
    }

    this.notifyUpdate()
  }

  removeIdentity(id: string) {
    this.identities = this.identities.filter(i => i.id !== id)
    this.saveToStorage('identities', this.identities)
    this.notifyUpdate()
  }

  getIdentities(): Identity[] {
    return this.identities
  }

  // Location events management
  addLocationEvent(event: LocationEvent) {
    // For addressable events, deduplicate by kind, pubkey, and d-tag
    const addressableKey = `${event.senderNpub}:${event.dTag || ''}`

    // Remove any existing event with the same addressable key
    this.locationEvents = this.locationEvents.filter(e => {
      const existingKey = `${e.senderNpub}:${e.dTag || ''}`
      return existingKey !== addressableKey
    })

    // Add the new event
    this.locationEvents.push(event)

    // Sort by created_at descending
    this.locationEvents.sort((a, b) => b.created_at - a.created_at)

    this.saveToStorage('locationEvents', this.locationEvents)
    mapService.updateLocations(this.locationEvents)
    this.notifyUpdate()
  }

  getLocationEvents(): LocationEvent[] {
    return this.locationEvents
  }

  getConnectedRelays(): string[] {
    return Array.from(this.connectedRelays.keys())
  }

  isRelayConnected(relayUrl: string): boolean {
    return this.connectedRelays.has(relayUrl)
  }

  // Relay connection management using Applesauce
  async connectToRelay(relayUrl: string) {
    try {
      // Close existing subscription if any
      const existingSub = this.activeSubscriptions.get(relayUrl)
      if (existingSub) {
        existingSub.unsubscribe()
      }

      // Create new relay connection
      const relay = new Relay(relayUrl)

      // Store the relay connection
      this.connectedRelays.set(relayUrl, relay)

      // Create subscription for location events
      const filter = {
        kinds: [30473],
        limit: 100
      }

      // Subscribe to events using req method which returns an Observable
      const sub = relay.req([filter]).subscribe({
        next: (response: any) => {
          if (response === 'EOSE') {
            console.log('End of stored events from', relayUrl)
          } else if (response.kind) {
            // It's an event
            eventStore.add(response)
            this.processLocationEvent(response)
          }
        },
        error: (error: any) => {
          console.error('Subscription error:', error)
        }
      })

      this.activeSubscriptions.set(relayUrl, sub)
      localStorage.setItem('spotstr_relayUrl', relayUrl)
      this.notifyUpdate()

      return true
    } catch (error) {
      console.error('Failed to connect to relay:', error)
      throw error
    }
  }

  // Publish location event using Applesauce EventFactory
  async publishLocationEvent(eventTemplate: any, relayUrls: string[]) {
    try {
      // Find the identity for signing
      const senderIdentity = this.identities.find(id => {
        if (!id.nsec) return false
        try {
          const decoded = nip19.decode(id.nsec)
          if (decoded.type === 'nsec') {
            const pubkey = getPublicKey(decoded.data as Uint8Array)
            return pubkey === eventTemplate.pubkey
          }
        } catch {}
        return false
      })

      if (!senderIdentity || !senderIdentity.nsec) {
        throw new Error('No matching identity with secret key found for signing')
      }

      // Decode the nsec to get the secret key
      const decoded = nip19.decode(senderIdentity.nsec)
      if (decoded.type !== 'nsec') {
        throw new Error('Invalid nsec')
      }

      const secretKey = decoded.data as Uint8Array

      // Sign the event using nostr-tools
      const { finalizeEvent } = await import('nostr-tools/pure')
      const signedEvent = finalizeEvent(eventTemplate, secretKey)

      // Publish to relays
      const publishPromises = relayUrls.map(url => {
        const relay = this.connectedRelays.get(url)
        if (relay) {
          return relay.publish(signedEvent)
        }
        return Promise.reject(new Error(`Not connected to relay ${url}`))
      })

      await Promise.allSettled(publishPromises)

      console.log('Published event:', signedEvent)
      return signedEvent
    } catch (error) {
      console.error('Failed to publish event:', error)
      throw error
    }
  }

  private async processLocationEvent(event: any) {
    const senderNpub = event.pubkey ? nip19.npubEncode(event.pubkey) : ''
    const dTag = event.tags?.find((t: any) => t[0] === 'd')?.[1] || ''
    const recipientPubkey = event.tags?.find((t: any) => t[0] === 'p')?.[1]
    const recipientNpub = recipientPubkey ? nip19.npubEncode(recipientPubkey) : ''

    const addressableId = `30473:${event.pubkey}:${dTag}`

    let decryptedGeohash = 'encrypted'
    let accuracy: number | undefined
    let nameFromContent: string | undefined

    // Try to decrypt if we have the recipient's private key
    if (recipientPubkey && event.content) {
      const recipientIdentity = this.identities.find(id => {
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

            const contentTags = JSON.parse(decryptedContent) as Array<[string, string]>
            const gTag = contentTags.find(t => t[0] === 'g')
            const accuracyTag = contentTags.find(t => t[0] === 'accuracy')
            const nameTag = contentTags.find(t => t[0] === 'name')

            if (gTag && gTag[1]) {
              decryptedGeohash = gTag[1]
            }

            if (accuracyTag && accuracyTag[1]) {
              accuracy = parseInt(accuracyTag[1])
            }

            if (nameTag && nameTag[1]) {
              nameFromContent = nameTag[1]
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
      senderPubkey: event.pubkey,
      receiverNpub: recipientNpub,
      dTag,
      geohash: decryptedGeohash,
      accuracy,
      expiry: event.tags?.find((t: any) => t[0] === 'expiration')?.[1],
      name: nameFromContent || dTag || undefined,
      encryptedContent: decryptedGeohash === 'encrypted' ? event.content : undefined,
    }

    this.addLocationEvent(locationEvent)
  }

  disconnectRelay(relayUrl: string) {
    const relay = this.connectedRelays.get(relayUrl)
    if (relay) {
      relay.close()
      this.connectedRelays.delete(relayUrl)
    }

    const sub = this.activeSubscriptions.get(relayUrl)
    if (sub) {
      sub.unsubscribe()
      this.activeSubscriptions.delete(relayUrl)
    }

    this.notifyUpdate()
    console.log(`Disconnected from ${relayUrl}`)
  }

  disconnectAll() {
    this.connectedRelays.forEach((relay, url) => {
      relay.close()
      console.log(`Disconnected from ${url}`)
    })
    this.connectedRelays.clear()

    this.activeSubscriptions.forEach((sub) => {
      sub.unsubscribe()
    })
    this.activeSubscriptions.clear()

    this.notifyUpdate()
  }

  clearAllLocations() {
    this.locationEvents = []
    this.saveToStorage('locationEvents', [])
    mapService.updateLocations([])
    this.notifyUpdate()
    console.log('Cleared all location events')
  }

  // Storage helpers
  private saveToStorage(key: string, data: any) {
    localStorage.setItem(`spotstr_${key}`, JSON.stringify(data))
  }

  private loadFromStorage() {
    try {
      const identities = JSON.parse(localStorage.getItem('spotstr_identities') || '[]')
      const locationEvents = JSON.parse(localStorage.getItem('spotstr_locationEvents') || '[]')

      this.identities = identities
      this.locationEvents = locationEvents

      if (locationEvents.length > 0) {
        mapService.updateLocations(locationEvents)
      }
    } catch (error) {
      console.error('Error loading from storage:', error)
    }
  }

  private async autoConnectToSavedRelay() {
    const savedRelayUrl = localStorage.getItem('spotstr_relayUrl')
    if (savedRelayUrl) {
      try {
        await this.connectToRelay(savedRelayUrl)
        console.log('Auto-connected to saved relay:', savedRelayUrl)
      } catch (error) {
        console.error('Failed to auto-connect to saved relay:', error)
      }
    }
  }

  private async decryptExistingLocationsForIdentity(identity: Identity) {
    if (!identity.nsec) return

    try {
      const decoded = nip19.decode(identity.nsec)
      if (decoded.type !== 'nsec') return

      const secretKey = decoded.data as Uint8Array
      const publicKey = getPublicKey(secretKey)

      let hasUpdates = false

      const updatedLocations = await Promise.all(
        this.locationEvents.map(async (location) => {
          if (location.geohash !== 'encrypted' || !location.encryptedContent) {
            return location
          }

          const recipientPubkey = location.receiverNpub ?
            this.npubToHex(location.receiverNpub) : null

          if (recipientPubkey !== publicKey) return location

          try {
            if (location.senderPubkey && location.encryptedContent) {
              const conversationKey = nip44.v2.utils.getConversationKey(
                secretKey,
                location.senderPubkey
              )

              const decryptedContent = nip44.v2.decrypt(
                location.encryptedContent,
                conversationKey
              )

              const contentTags = JSON.parse(decryptedContent) as Array<[string, string]>
              const gTag = contentTags.find(t => t[0] === 'g')
              const accuracyTag = contentTags.find(t => t[0] === 'accuracy')
              const nameTag = contentTags.find(t => t[0] === 'name')

              if (gTag && gTag[1]) {
                hasUpdates = true
                return {
                  ...location,
                  geohash: gTag[1],
                  accuracy: accuracyTag ? parseInt(accuracyTag[1]) : location.accuracy,
                  name: nameTag?.[1] || location.name
                }
              }
            }
            return location
          } catch (error) {
            console.error('Failed to decrypt location:', error)
            return location
          }
        })
      )

      if (hasUpdates) {
        this.locationEvents = updatedLocations
        this.saveToStorage('locationEvents', updatedLocations)
        mapService.updateLocations(updatedLocations)
        this.notifyUpdate()
      }
    } catch (error) {
      console.error('Error decrypting locations for new identity:', error)
    }
  }

  private npubToHex(npub: string): string | null {
    try {
      const decoded = nip19.decode(npub)
      if (decoded.type === 'npub') {
        return decoded.data as string
      }
    } catch {}
    return null
  }

  // Update notification system
  subscribe(callback: () => void) {
    this.updateCallbacks.add(callback)
    return () => {
      this.updateCallbacks.delete(callback)
    }
  }

  private notifyUpdate() {
    this.updateCallbacks.forEach(cb => cb())
  }
}

// Create singleton instance
const nostrService = new NostrApplesauceService()

// Custom hook for using the Nostr service
export function useNostr() {
  const [identities, setIdentities] = useState<Identity[]>(nostrService.getIdentities())
  const [locationEvents, setLocationEvents] = useState<LocationEvent[]>(nostrService.getLocationEvents())
  const [connectedRelays, setConnectedRelays] = useState<string[]>(nostrService.getConnectedRelays())

  useEffect(() => {
    const updateState = () => {
      setIdentities(nostrService.getIdentities())
      setLocationEvents(nostrService.getLocationEvents())
      setConnectedRelays(nostrService.getConnectedRelays())
    }

    // Subscribe to updates
    const unsubscribe = nostrService.subscribe(updateState)

    // Initial state
    updateState()

    return unsubscribe
  }, [])

  const relayStatus = useMemo(() => {
    const status = new Map<string, boolean>()
    connectedRelays.forEach(url => status.set(url, true))
    return status
  }, [connectedRelays])

  return {
    identities,
    locationEvents,
    connectedRelays,
    relayStatus,
    addIdentity: (identity: Identity) => nostrService.addIdentity(identity),
    removeIdentity: (id: string) => nostrService.removeIdentity(id),
    addLocationEvent: (event: LocationEvent) => nostrService.addLocationEvent(event),
    connectToRelay: (url: string) => nostrService.connectToRelay(url),
    disconnectRelay: (url: string) => nostrService.disconnectRelay(url),
    isRelayConnected: (url: string) => nostrService.isRelayConnected(url),
    publishLocationEvent: (event: any, relayUrls: string[]) => nostrService.publishLocationEvent(event, relayUrls),
    disconnectAll: () => nostrService.disconnectAll(),
    clearAllLocations: () => nostrService.clearAllLocations(),
  }
}

// Export the event store for advanced usage
export { eventStore }