// Core application types
export interface Identity {
  id: string
  name?: string
  source: 'created' | 'npub' | 'nsec' | 'extension'
  npub: string
  nsec?: string
  created_at: number
}

export interface LocationEvent {
  id: string // For addressable events: "kind:pubkey:d-tag"
  name?: string // Display name for the location (same as d-tag if provided)
  eventId: string // Nostr event ID
  created_at: number
  senderNpub: string
  receiverNpub?: string
  dTag?: string // d-tag for addressable events (empty string for single location)
  geohash: string
  accuracy?: number
  expiry?: number
}

export interface Settings {
  locationRelay: string
}

export type PageType = 'identities' | 'locations' | 'settings' | 'eventlog'