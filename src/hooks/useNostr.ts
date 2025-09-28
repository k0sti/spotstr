import { useState, useEffect, useMemo } from 'react'
import { EventStore } from 'applesauce-core'
import { onlyEvents } from 'applesauce-relay/operators'
import * as nip19 from 'nostr-tools/nip19'
import * as nip44 from 'nostr-tools/nip44'
import { LocationEvent } from '../types'
import { mapService } from '../services/mapService'
import { groupsManager } from '../services/groups'
import { getRelayService } from '../services/relayService'
import { Subscription } from 'rxjs'

// Initialize Applesauce EventStore
const eventStore = new EventStore()

class NostrApplesauceService {
  private locationEvents: LocationEvent[] = []
  private relayService = getRelayService()
  private updateCallbacks: Set<() => void> = new Set()
  private locationSubscription: Subscription | null = null
  private newEncryptedEventCallbacks: Set<() => void> = new Set()
  private currentAccounts: any[] = []
  private pendingDecryptions: Set<string> = new Set()

  constructor() {
    this.loadFromStorage()
    this.setupLocationSubscriptions()
    this.autoConnectSavedRelays()
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
    return this.relayService.getConnectedRelays('location')
  }

  isRelayConnected(relayUrl: string): boolean {
    const configs = this.relayService.getRelayConfigs('location')
    return configs.some(c => c.url === relayUrl && c.status === 'connected')
  }

  // Setup subscriptions to location relays
  private setupLocationSubscriptions() {
    // Clean up existing subscription
    if (this.locationSubscription) {
      this.locationSubscription.unsubscribe()
    }

    // Subscribe to relay status changes
    // Only update subscriptions when relay connections actually change
    let lastConnectedRelays: string[] = []
    this.relayService.relayStatus$.subscribe(() => {
      const currentConnectedRelays = this.relayService.getConnectedRelays('location')

      // Only update if the connected relays have changed
      const hasChanged = currentConnectedRelays.length !== lastConnectedRelays.length ||
        currentConnectedRelays.some(r => !lastConnectedRelays.includes(r))

      if (hasChanged) {
        lastConnectedRelays = [...currentConnectedRelays]
        this.updateLocationSubscriptions()
      }
    })
  }

  private updateLocationSubscriptions() {
    // Clean up existing subscription
    if (this.locationSubscription) {
      this.locationSubscription.unsubscribe()
      this.locationSubscription = null
    }

    // Get location relay group
    const locationGroup = this.relayService.getLocationGroup()
    if (!locationGroup) {
      console.log('No connected location relays')
      return
    }

    // Create subscription for location events
    const filter = {
      kinds: [30472, 30473],
    }

    this.locationSubscription = locationGroup
      .req([filter])
      .pipe(onlyEvents())
      .subscribe({
        next: (event: any) => {
          // Track stats
          const relays = this.relayService.getConnectedRelays('location')
          if (relays.length > 0) {
            this.relayService.updateStats(relays[0], 'received')
          }

          eventStore.add(event)
          this.processLocationEvent(event)
        },
        error: (error: any) => {
          console.error('Subscription error:', error)
        }
      })

    console.log('Subscribed to location events from relay group')
  }

  // Relay connection management (delegate to relay service)
  async connectToRelay(relayUrl: string) {
    try {
      await this.relayService.connectRelay(relayUrl, 'location')
      this.notifyUpdate()
      return true
    } catch (error) {
      console.error('Failed to connect to relay:', error)
      throw error
    }
  }

  // Publish location event using RelayPool
  async publishLocationEvent(eventTemplate: any, relayUrls: string[], signer: any) {
    try {
      // Sign the event using the provided signer
      const signedEvent = await signer.signEvent(eventTemplate)

      // Use location group if no specific URLs provided
      if (!relayUrls || relayUrls.length === 0) {
        const locationGroup = this.relayService.getLocationGroup()
        if (locationGroup) {
          const responses = await locationGroup.publish(signedEvent)
          responses.forEach(resp => {
            if (resp.ok) {
              this.relayService.updateStats(resp.from, 'sent')
            }
          })
          console.log('Published event to location group:', signedEvent)
          return signedEvent
        }
      } else {
        // Publish to specific relays
        const pool = this.relayService.getPool()
        const responses = await pool.publish(relayUrls, signedEvent)
        responses.forEach(resp => {
          if (resp.ok) {
            this.relayService.updateStats(resp.from, 'sent')
          }
        })
      }

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
      await this.processPrivateLocationEvent(event)
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

    // Attempt immediate decryption if accounts are available
    if (this.currentAccounts.length > 0 && !this.pendingDecryptions.has(addressableId)) {
      this.pendingDecryptions.add(addressableId)
      setTimeout(() => {
        this.decryptSingleEvent(addressableId)
        this.pendingDecryptions.delete(addressableId)
      }, 100) // Small delay to batch multiple events
    }
  }

  private async processPrivateLocationEvent(event: any) {
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

  // Set accounts for automatic decryption
  setAccounts(accounts: any[]) {
    this.currentAccounts = accounts
    // Trigger decryption of any existing encrypted events
    if (accounts.length > 0) {
      this.decryptLocationEvents(accounts)
    }
  }

  // Decrypt a single event by its addressable ID
  async decryptSingleEvent(addressableId: string) {
    const event = this.locationEvents.find(e => e.id === addressableId)
    if (!event || event.geohash !== 'encrypted' || !event.encryptedContent) {
      return
    }

    const groups = groupsManager.groups$.value
    let decrypted = false

    // Try to decrypt with accounts
    for (const account of this.currentAccounts) {
      try {
        const accountNpub = nip19.npubEncode(account.pubkey)
        if (event.receiverNpub !== accountNpub) {
          continue
        }

        if (account.signer.nip44?.decrypt) {
          const senderPubkey = nip19.decode(event.senderNpub).data as string
          const decryptedContent = await account.signer.nip44.decrypt(
            senderPubkey,
            event.encryptedContent
          )

          const decryptedTags = JSON.parse(decryptedContent)
          const allTags = this.extractAllTags(decryptedTags)

          // Update the event in place
          const index = this.locationEvents.findIndex(e => e.id === addressableId)
          if (index !== -1) {
            this.locationEvents[index] = {
              ...event,
              geohash: allTags.g || '',
              tags: allTags,
              name: allTags.title || allTags.name || event.dTag || undefined,
            }
            decrypted = true
            break
          }
        }
      } catch (error) {
        console.error('Failed to decrypt with account:', error)
      }
    }

    // Try with groups if not decrypted
    if (!decrypted) {
      for (const group of groups) {
        try {
          if (event.receiverNpub !== group.npub) {
            continue
          }

          const senderPubkey = nip19.decode(event.senderNpub).data as string
          const groupSecretKey = nip19.decode(group.nsec).data as Uint8Array
          const conversationKey = nip44.v2.utils.getConversationKey(
            groupSecretKey,
            senderPubkey
          )
          const decryptedContent = nip44.v2.decrypt(event.encryptedContent, conversationKey)
          const decryptedTags = JSON.parse(decryptedContent)
          const allTags = this.extractAllTags(decryptedTags)

          // Update the event in place
          const index = this.locationEvents.findIndex(e => e.id === addressableId)
          if (index !== -1) {
            this.locationEvents[index] = {
              ...event,
              geohash: allTags.g || '',
              tags: allTags,
              name: allTags.title || allTags.name || event.dTag || undefined,
            }
            decrypted = true
            break
          }
        } catch (error) {
          console.error('Failed to decrypt with group:', error)
        }
      }
    }

    if (decrypted) {
      this.saveToStorage('locationEvents', this.locationEvents)
      mapService.updateLocations(this.locationEvents)
      this.notifyUpdate()
    }
  }

  // Decrypt location events using available accounts and groups
  async decryptLocationEvents(accounts: any[]) {
    // Store accounts for future automatic decryption
    this.currentAccounts = accounts
    const updatedEvents: LocationEvent[] = []
    let hasUpdates = false
    const groups = groupsManager.groups$.value

    for (const event of this.locationEvents) {
      // Only process encrypted private events
      if (event.eventKind === 30473 && event.encryptedContent && event.geohash === 'encrypted') {
        let decrypted = false

        // First try to decrypt with accounts
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
            console.error('Failed to decrypt location event with account:', error)
          }
        }

        // If not decrypted with accounts, try with groups
        if (!decrypted) {
          for (const group of groups) {
            try {
              // Check if this group is the recipient
              if (event.receiverNpub !== group.npub) {
                continue
              }

              // Get sender's pubkey from npub
              const senderPubkey = nip19.decode(event.senderNpub).data as string

              // Get group's private key from nsec
              const groupSecretKey = nip19.decode(group.nsec).data as Uint8Array

              // Get conversation key for decryption
              const conversationKey = nip44.v2.utils.getConversationKey(
                groupSecretKey,
                senderPubkey
              )

              // Decrypt the content
              const decryptedContent = nip44.v2.decrypt(event.encryptedContent, conversationKey)

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
            } catch (error) {
              console.error('Failed to decrypt location event with group:', error)
            }
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
    this.relayService.disconnectRelay(relayUrl)
    this.notifyUpdate()
    console.log(`Disconnected from ${relayUrl}`)
  }

  disconnectAll() {
    const locationRelays = this.relayService.getConnectedRelays('location')
    locationRelays.forEach(url => {
      this.relayService.disconnectRelay(url)
    })
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

  private async autoConnectSavedRelays() {
    // Auto-connection is handled by relayService based on saved enabled states
    const connectedRelays = this.relayService.getConnectedRelays('location')
    if (connectedRelays.length > 0) {
      console.log('Auto-connected to saved location relays:', connectedRelays)
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
    setAccounts: (accounts: any[]) => nostrService.setAccounts(accounts),
  }
}

// Export the event store for advanced usage
export { eventStore }