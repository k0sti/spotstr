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
  id: string
  name?: string
  eventId: string
  created_at: number
  senderNpub: string
  receiverNpub?: string
  dTag?: string
  geohash: string
  accuracy?: number
  expiry?: number
}

export interface Settings {
  locationRelay: string
}

export type PageType = 'identities' | 'locations' | 'settings' | 'eventlog'