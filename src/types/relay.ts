export type RelayType = 'location' | 'profile'

export type RelayStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface RelayStats {
  receivedEvents: number
  sentEvents: number
}

export interface RelayConfig {
  url: string
  type: RelayType
  enabled: boolean
  status: RelayStatus
  errorMessage?: string
  stats?: RelayStats
}