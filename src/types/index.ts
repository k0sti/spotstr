// Core application types
export interface Identity {
  id: string
  name?: string
  source: 'created' | 'npub' | 'nsec' | 'extension' | 'amber' | 'bunker'
  npub: string
  nsec?: string
  bunkerUri?: string // For reconnecting to bunker signers
  created_at: number
}

export interface LocationEvent {
  id: string // For addressable events: "kind:pubkey:d-tag"
  name?: string // Display name for the location (from d-tag or tags.title)
  eventId: string // Nostr event ID
  created_at: number
  senderNpub: string
  receiverNpub?: string // For encrypted events only
  dTag?: string // d-tag for addressable events (empty string for single location)
  geohash: string
  expiry?: number
  encryptedContent?: string // Store encrypted content for later decryption

  // New fields for public/private distinction
  eventKind: 30472 | 30473 // Event kind to distinguish public/private
  tags?: Record<string, any> // Generic metadata storage for all tags
}

export interface Settings {
  locationRelay: string
}

export type PageType = 'identities' | 'locations' | 'settings' | 'eventlog'