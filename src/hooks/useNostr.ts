import { useState, useEffect, useMemo } from 'react'
import { EventStore } from 'applesauce-core'
import { Relay } from 'applesauce-relay'
import * as nip19 from 'nostr-tools/nip19'
import { LocationEvent } from '../types'
import { mapService } from '../services/mapService'

// Initialize Applesauce EventStore
const eventStore = new EventStore()

class NostrApplesauceService {
  private locationEvents: LocationEvent[] = []
  private connectedRelays: Map<string, Relay> = new Map()
  private updateCallbacks: Set<() => void> = new Set()
  private activeSubscriptions: Map<string, any> = new Map()
  private newEncryptedEventCallbacks: Set<() => void> = new Set()

  constructor() {
    this.loadFromStorage()
    this.autoConnectToSavedRelay()
  }


  // Location events management
  addLocationEvent(event: LocationEvent) {
    // For addressable events, deduplicate by id (kind:pubkey:d-tag)
    // Remove any existing event with the same addressable id
    this.locationEvents = this.locationEvents.filter(e => e.id !== event.id)

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

      // Create subscription for location events (both public and private)
      const filter = {
        kinds: [30472, 30473],
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

  // Publish location event using Applesauce
  async publishLocationEvent(eventTemplate: any, relayUrls: string[], signer: any) {
    try {
      // Sign the event using the provided signer
      const signedEvent = await signer.signEvent(eventTemplate)

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
    if (event.kind === 30472) {
      this.processPublicLocationEvent(event)
    } else if (event.kind === 30473) {
      this.processPrivateLocationEvent(event)
    }
  }

  private processPublicLocationEvent(event: any) {
    const senderNpub = event.pubkey ? nip19.npubEncode(event.pubkey) : ''
    const dTag = event.tags?.find((t: any) => t[0] === 'd')?.[1] || ''
    const addressableId = `${event.kind}:${event.pubkey}:${dTag}`

    // Extract all tags including geohash
    const allTags = this.extractAllTags(event.tags)
    const geohash = allTags.g || ''
    const expiry = allTags.expiration

    const locationEvent: LocationEvent = {
      id: addressableId,
      eventId: event.id,
      created_at: event.created_at,
      senderNpub,
      receiverNpub: undefined, // Public events have no receiver
      dTag,
      geohash,
      expiry,
      name: allTags.title || dTag || undefined,
      eventKind: 30472,
      tags: allTags,
      encryptedContent: undefined,
    }

    this.addLocationEvent(locationEvent)
  }

  private processPrivateLocationEvent(event: any) {
    const senderNpub = event.pubkey ? nip19.npubEncode(event.pubkey) : ''
    const dTag = event.tags?.find((t: any) => t[0] === 'd')?.[1] || ''
    const recipientPubkey = event.tags?.find((t: any) => t[0] === 'p')?.[1]
    const recipientNpub = recipientPubkey ? nip19.npubEncode(recipientPubkey) : ''
    const addressableId = `${event.kind}:${event.pubkey}:${dTag}`
    const expiry = event.tags?.find((t: any) => t[0] === 'expiration')?.[1]

    // For now, mark as encrypted until decryption is performed
    let decryptedGeohash = 'encrypted'

    const locationEvent: LocationEvent = {
      id: addressableId,
      eventId: event.id,
      created_at: event.created_at,
      senderNpub,
      receiverNpub: recipientNpub,
      dTag,
      geohash: decryptedGeohash,
      expiry,
      name: dTag || undefined,
      eventKind: 30473,
      tags: undefined, // Will be populated after decryption
      encryptedContent: event.content,
    }

    this.addLocationEvent(locationEvent)

    // Trigger decryption attempt notification
    this.notifyNewEncryptedEvent()
  }

  private extractAllTags(tags: any[]): Record<string, any> {
    const tagObj: Record<string, any> = {}
    tags?.forEach((tag: any[]) => {
      const [key, ...values] = tag
      if (key === 't') {
        // Collect multiple hashtags
        tagObj.t = tagObj.t || []
        tagObj.t.push(values[0])
      } else {
        // Single value tags
        tagObj[key] = values.length === 1 ? values[0] : values
      }
    })
    return tagObj
  }

  // Decrypt location events using available accounts
  async decryptLocationEvents(accounts: any[]) {
    const updatedEvents: LocationEvent[] = []
    let hasUpdates = false

    for (const event of this.locationEvents) {
      // Only process encrypted private events
      if (event.eventKind === 30473 && event.encryptedContent && event.geohash === 'encrypted') {
        let decrypted = false

        // Try to decrypt with each account
        for (const account of accounts) {
          try {
            // Check if this account is the recipient
            const accountNpub = nip19.npubEncode(account.pubkey)
            if (event.receiverNpub !== accountNpub) {
              continue
            }

            // Attempt decryption using NIP-44
            if (account.signer.nip44?.decrypt) {
              // Get sender's pubkey from npub
              const senderPubkey = nip19.decode(event.senderNpub).data as string

              const decryptedContent = await account.signer.nip44.decrypt(
                senderPubkey,
                event.encryptedContent
              )

              // Parse decrypted content (should be JSON array of tags)
              const decryptedTags = JSON.parse(decryptedContent)
              const allTags = this.extractAllTags(decryptedTags)

              // Update the event with decrypted data
              const updatedEvent: LocationEvent = {
                ...event,
                geohash: allTags.g || '',
                tags: allTags,
                name: allTags.title || allTags.name || event.dTag || undefined,
              }

              updatedEvents.push(updatedEvent)
              decrypted = true
              hasUpdates = true
              break
            }
          } catch (error) {
            console.error('Failed to decrypt location event:', error)
          }
        }

        if (!decrypted) {
          updatedEvents.push(event)
        }
      } else {
        updatedEvents.push(event)
      }
    }

    if (hasUpdates) {
      this.locationEvents = updatedEvents
      this.saveToStorage('locationEvents', this.locationEvents)
      mapService.updateLocations(this.locationEvents)
      this.notifyUpdate()
    }
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
      const locationEvents = JSON.parse(localStorage.getItem('spotstr_locationEvents') || '[]')

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


  // Update notification system
  subscribe(callback: () => void) {
    this.updateCallbacks.add(callback)
    return () => {
      this.updateCallbacks.delete(callback)
    }
  }

  subscribeToNewEncryptedEvents(callback: () => void) {
    this.newEncryptedEventCallbacks.add(callback)
    return () => {
      this.newEncryptedEventCallbacks.delete(callback)
    }
  }

  private notifyUpdate() {
    this.updateCallbacks.forEach(cb => cb())
  }

  private notifyNewEncryptedEvent() {
    this.newEncryptedEventCallbacks.forEach(cb => cb())
  }
}

// Create singleton instance
const nostrService = new NostrApplesauceService()

// Custom hook for using the Nostr service
export function useNostr() {
  const [locationEvents, setLocationEvents] = useState<LocationEvent[]>(nostrService.getLocationEvents())
  const [connectedRelays, setConnectedRelays] = useState<string[]>(nostrService.getConnectedRelays())

  useEffect(() => {
    const updateState = () => {
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
    locationEvents,
    connectedRelays,
    relayStatus,
    addLocationEvent: (event: LocationEvent) => nostrService.addLocationEvent(event),
    connectToRelay: (url: string) => nostrService.connectToRelay(url),
    disconnectRelay: (url: string) => nostrService.disconnectRelay(url),
    isRelayConnected: (url: string) => nostrService.isRelayConnected(url),
    publishLocationEvent: (event: any, relayUrls: string[], signer: any) => nostrService.publishLocationEvent(event, relayUrls, signer),
    disconnectAll: () => nostrService.disconnectAll(),
    clearAllLocations: () => nostrService.clearAllLocations(),
    decryptLocationEvents: (accounts: any[]) => nostrService.decryptLocationEvents(accounts),
  }
}

// Export the event store for advanced usage
export { eventStore }