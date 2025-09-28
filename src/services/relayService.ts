import { BehaviorSubject, Subscription } from 'rxjs'
import { RelayPool } from 'applesauce-relay'
import { RelayConfig, RelayType, RelayStats } from '../types/relay'

class RelayService {
  private pool: RelayPool
  private relayConfigs: Map<string, RelayConfig> = new Map()
  private relaySubscriptions: Map<string, Subscription> = new Map()
  private relayStats: Map<string, RelayStats> = new Map()
  public relayStatus$ = new BehaviorSubject<Map<string, RelayConfig>>(new Map())

  constructor() {
    this.pool = new RelayPool()
    this.loadSavedConfigs()
    this.setupRelayMonitoring()
  }

  private loadSavedConfigs() {
    // Load location relays
    const savedLocationRelays = localStorage.getItem('spotstr_locationRelays')
    if (savedLocationRelays) {
      try {
        const urls = JSON.parse(savedLocationRelays) as string[]
        urls.forEach(url => {
          this.relayConfigs.set(url, {
            url,
            type: 'location',
            enabled: false,
            status: 'disconnected'
          })
        })
      } catch (e) {
        console.error('Failed to load location relays:', e)
        this.loadDefaultLocationRelays()
      }
    } else {
      this.loadDefaultLocationRelays()
    }

    // Load profile relays
    const savedProfileRelays = localStorage.getItem('spotstr_profileRelays')
    if (savedProfileRelays) {
      try {
        const urls = JSON.parse(savedProfileRelays) as string[]
        urls.forEach(url => {
          this.relayConfigs.set(url, {
            url,
            type: 'profile',
            enabled: false,
            status: 'disconnected'
          })
        })
      } catch (e) {
        console.error('Failed to load profile relays:', e)
        this.loadDefaultProfileRelays()
      }
    } else {
      this.loadDefaultProfileRelays()
    }

    // Load enabled states
    const savedEnabledStates = localStorage.getItem('spotstr_relayEnabledStates')
    if (savedEnabledStates) {
      try {
        const states = JSON.parse(savedEnabledStates) as Record<string, boolean>
        Object.entries(states).forEach(([url, enabled]) => {
          const config = this.relayConfigs.get(url)
          if (config) {
            config.enabled = enabled
            if (enabled) {
              // Use setTimeout to ensure everything is initialized before connecting
              setTimeout(() => {
                this.connectRelay(url, config.type)
              }, 100)
            }
          }
        })
      } catch (e) {
        console.error('Failed to load enabled states:', e)
      }
    }

    this.notifyStatusUpdate()
  }

  private loadDefaultLocationRelays() {
    const defaults = [
      'wss://precision.bilberry-tetra.ts.net/relay',
      'wss://relay.damus.io'  // Use a more reliable public relay as fallback
    ]
    defaults.forEach(url => {
      this.relayConfigs.set(url, {
        url,
        type: 'location',
        enabled: false,
        status: 'disconnected'
      })
    })
  }

  private loadDefaultProfileRelays() {
    const defaults = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.nostr.band'
    ]
    defaults.forEach(url => {
      this.relayConfigs.set(url, {
        url,
        type: 'profile',
        enabled: false,
        status: 'disconnected'
      })
    })
  }

  private setupRelayMonitoring() {
    // Monitor relay connections via pool.relays$
    this.pool.relays$.subscribe(relaysMap => {
      relaysMap.forEach((relay, url) => {
        const config = this.relayConfigs.get(url)
        if (config && config.enabled) {
          // Only set up monitoring if we haven't already
          if (!this.relaySubscriptions.has(url)) {
            console.log(`Setting up monitoring for relay: ${url}`)

            const sub = relay.connected$.subscribe(connected => {
              // Only update if config still exists and is enabled
              const currentConfig = this.relayConfigs.get(url)
              if (currentConfig && currentConfig.enabled) {
                console.log(`Relay ${url} connection status: ${connected}`)
                currentConfig.status = connected ? 'connected' : 'disconnected'
                currentConfig.errorMessage = undefined

                // Get stats if available
                const stats = this.relayStats.get(url)
                if (stats) {
                  currentConfig.stats = stats
                }

                this.notifyStatusUpdate()
              }
            })

            this.relaySubscriptions.set(url, sub)

            // Monitor notices for errors
            relay.notices$.subscribe(notices => {
              if (notices.length > 0) {
                const lastNotice = notices[notices.length - 1]
                const currentConfig = this.relayConfigs.get(url)
                if (currentConfig) {
                  currentConfig.errorMessage = lastNotice
                  if (!relay.connected$.value) {
                    currentConfig.status = 'error'
                    this.notifyStatusUpdate()
                  }
                }
              }
            })

            // Check current connection state immediately
            const currentConnected = relay.connected$.value
            if (currentConnected !== undefined) {
              console.log(`Initial connection state for ${url}: ${currentConnected}`)
              config.status = currentConnected ? 'connected' : 'disconnected'
              this.notifyStatusUpdate()
            }
          }
        }
      })
    })
  }

  async connectRelay(url: string, type: RelayType): Promise<void> {
    const config = this.relayConfigs.get(url)
    if (!config) {
      // Add new relay config
      this.relayConfigs.set(url, {
        url,
        type,
        enabled: true,
        status: 'connecting'
      })
    } else {
      config.enabled = true
      config.status = 'connecting'
    }

    // Initialize stats
    if (!this.relayStats.has(url)) {
      this.relayStats.set(url, { receivedEvents: 0, sentEvents: 0 })
    }

    this.notifyStatusUpdate()
    this.saveConfigs()

    // Get or create relay connection via pool
    const relay = this.pool.relay(url)

    // Set up monitoring for this specific relay if not already done
    if (!this.relaySubscriptions.has(url)) {
      console.log(`Setting up monitoring for relay: ${url}`)

      const sub = relay.connected$.subscribe(connected => {
        const currentConfig = this.relayConfigs.get(url)
        if (currentConfig && currentConfig.enabled) {
          console.log(`Relay ${url} connection status: ${connected}`)
          currentConfig.status = connected ? 'connected' : 'disconnected'
          currentConfig.errorMessage = undefined

          // Get stats if available
          const stats = this.relayStats.get(url)
          if (stats) {
            currentConfig.stats = stats
          }

          this.notifyStatusUpdate()
        }
      })

      this.relaySubscriptions.set(url, sub)

      // Monitor notices for errors
      relay.notices$.subscribe(notices => {
        if (notices.length > 0) {
          const lastNotice = notices[notices.length - 1]
          const currentConfig = this.relayConfigs.get(url)
          if (currentConfig) {
            currentConfig.errorMessage = lastNotice
            if (!relay.connected$.value) {
              currentConfig.status = 'error'
              this.notifyStatusUpdate()
            }
          }
        }
      })
    }

    // Force connection by making a simple request
    // This will trigger the actual WebSocket connection
    let testSub: any = null
    testSub = relay.req([{ limit: 1 }]).subscribe({
      next: (response) => {
        // If we get EOSE, connection is successful
        if (response === 'EOSE' && testSub) {
          // Unsubscribe from test request
          testSub.unsubscribe()
          testSub = null
        }
      },
      error: (error) => {
        console.error(`Failed to connect to ${url}:`, error)
        const currentConfig = this.relayConfigs.get(url)
        if (currentConfig) {
          currentConfig.status = 'error'
          currentConfig.errorMessage = error.message || 'Connection failed'
          this.notifyStatusUpdate()
        }
        // Unsubscribe on error if subscription exists
        if (testSub) {
          testSub.unsubscribe()
          testSub = null
        }
      }
    })
  }

  async disconnectRelay(url: string): Promise<void> {
    const config = this.relayConfigs.get(url)
    if (config) {
      config.enabled = false
      config.status = 'disconnected'
      config.errorMessage = undefined
    }

    // Unsubscribe from monitoring
    const sub = this.relaySubscriptions.get(url)
    if (sub) {
      sub.unsubscribe()
      this.relaySubscriptions.delete(url)
    }

    // Note: We don't close the relay here because applesauce RelayPool
    // manages relay lifecycle. Just update our tracking state.
    // The pool will handle reconnection if needed.

    this.notifyStatusUpdate()
    this.saveConfigs()
  }

  addRelay(url: string, type: RelayType): void {
    if (!this.relayConfigs.has(url)) {
      this.relayConfigs.set(url, {
        url,
        type,
        enabled: false,
        status: 'disconnected'
      })
      this.saveConfigs()
      this.notifyStatusUpdate()
    }
  }

  removeRelay(url: string, type: RelayType): void {
    const config = this.relayConfigs.get(url)
    if (config && config.type === type) {
      // Disconnect if connected
      if (config.enabled) {
        this.disconnectRelay(url)
      }
      this.relayConfigs.delete(url)
      this.saveConfigs()
      this.notifyStatusUpdate()
    }
  }

  updateRelayUrl(oldUrl: string, newUrl: string, type: RelayType): void {
    const config = this.relayConfigs.get(oldUrl)
    if (config && config.type === type) {
      // Disconnect old relay if connected
      if (config.enabled) {
        this.disconnectRelay(oldUrl)
      }

      // Remove old config
      this.relayConfigs.delete(oldUrl)

      // Add new config
      this.relayConfigs.set(newUrl, {
        url: newUrl,
        type,
        enabled: config.enabled,
        status: 'disconnected'
      })

      // Reconnect if was enabled
      if (config.enabled) {
        this.connectRelay(newUrl, type)
      }

      this.saveConfigs()
      this.notifyStatusUpdate()
    }
  }

  resetToDefaults(type: RelayType, defaultUrls: string[]): void {
    // Remove all relays of this type
    Array.from(this.relayConfigs.entries())
      .filter(([_, config]) => config.type === type)
      .forEach(([url, config]) => {
        if (config.enabled) {
          this.disconnectRelay(url)
        }
        this.relayConfigs.delete(url)
      })

    // Add default relays
    defaultUrls.forEach(url => {
      this.relayConfigs.set(url, {
        url,
        type,
        enabled: false,
        status: 'disconnected'
      })
    })

    this.saveConfigs()
    this.notifyStatusUpdate()
  }

  getRelayConfigs(type: RelayType): RelayConfig[] {
    return Array.from(this.relayConfigs.values())
      .filter(config => config.type === type)
  }

  getConnectedRelays(type: RelayType): string[] {
    return Array.from(this.relayConfigs.values())
      .filter(config => config.type === type && config.status === 'connected')
      .map(config => config.url)
  }

  getPool(): RelayPool {
    return this.pool
  }

  getLocationGroup() {
    const urls = this.getConnectedRelays('location')
    return urls.length > 0 ? this.pool.group(urls) : null
  }

  getProfileGroup() {
    const urls = this.getConnectedRelays('profile')
    return urls.length > 0 ? this.pool.group(urls) : null
  }

  updateStats(url: string, type: 'received' | 'sent'): void {
    const stats = this.relayStats.get(url)
    if (stats) {
      if (type === 'received') {
        stats.receivedEvents++
      } else {
        stats.sentEvents++
      }

      const config = this.relayConfigs.get(url)
      if (config) {
        config.stats = stats
        this.notifyStatusUpdate()
      }
    }
  }

  private saveConfigs(): void {
    // Save location relay URLs
    const locationUrls = Array.from(this.relayConfigs.values())
      .filter(c => c.type === 'location')
      .map(c => c.url)
    localStorage.setItem('spotstr_locationRelays', JSON.stringify(locationUrls))

    // Save profile relay URLs
    const profileUrls = Array.from(this.relayConfigs.values())
      .filter(c => c.type === 'profile')
      .map(c => c.url)
    localStorage.setItem('spotstr_profileRelays', JSON.stringify(profileUrls))

    // Save enabled states
    const enabledStates: Record<string, boolean> = {}
    this.relayConfigs.forEach((config, url) => {
      enabledStates[url] = config.enabled
    })
    localStorage.setItem('spotstr_relayEnabledStates', JSON.stringify(enabledStates))
  }

  private notifyStatusUpdate(): void {
    this.relayStatus$.next(new Map(this.relayConfigs))
  }
}

// Singleton instance
let relayServiceInstance: RelayService | null = null

export function getRelayService(): RelayService {
  if (!relayServiceInstance) {
    relayServiceInstance = new RelayService()
  }
  return relayServiceInstance
}

export function useRelayService(): RelayService {
  return getRelayService()
}