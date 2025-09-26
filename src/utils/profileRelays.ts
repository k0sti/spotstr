// Default profile relays for fetching user metadata
export const DEFAULT_PROFILE_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band'
]

// Get configured profile relays from localStorage
export function getProfileRelays(): string[] {
  const saved = localStorage.getItem('spotstr_profileRelays')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    } catch (e) {
      console.error('Failed to parse profile relays:', e)
    }
  }
  return DEFAULT_PROFILE_RELAYS
}

// Fetch profile for a given pubkey using applesauce
export async function fetchProfile(pubkey: string, useCache = true): Promise<any> {
  try {
    // Import cache manager
    const { profileCacheManager } = await import('../services/profileCache')

    // Check cache first if enabled
    if (useCache) {
      const cached = profileCacheManager.getProfile(pubkey)
      if (cached) {
        console.log(`Using cached profile for ${pubkey}`)
        return cached
      }
    }

    const relays = getProfileRelays()

    // Import necessary modules
    const { Relay } = await import('applesauce-relay')
    const { getProfileContent } = await import('applesauce-core/helpers')

    // Try each relay until we get a profile
    for (const relayUrl of relays) {
      let relay: any = null
      try {
        relay = new Relay(relayUrl)

        // Request profile events (kind 0)
        const events = await new Promise<any[]>((resolve) => {
          const collectedEvents: any[] = []
          let isResolved = false

          const cleanup = () => {
            if (!isResolved) {
              isResolved = true
              try {
                if (relay && relay.close) {
                  relay.close()
                }
              } catch (e) {
                // Ignore close errors
              }
              resolve(collectedEvents)
            }
          }

          const sub = relay.request({
            kinds: [0],
            authors: [pubkey],
            limit: 1
          }).subscribe({
            next: (event: any) => {
              if (event && !Array.isArray(event)) {
                collectedEvents.push(event)
              } else if (Array.isArray(event)) {
                collectedEvents.push(...event)
              }
            },
            complete: () => {
              cleanup()
            },
            error: (error: any) => {
              console.error(`Failed to fetch from ${relayUrl}:`, error)
              cleanup()
            }
          })

          // Timeout after 3 seconds
          setTimeout(() => {
            if (sub) {
              sub.unsubscribe()
            }
            cleanup()
          }, 3000)
        })

        // Find the most recent profile event
        if (events.length > 0) {
          const mostRecent = events.reduce((prev, curr) =>
            curr.created_at > prev.created_at ? curr : prev
          )

          const profile = getProfileContent(mostRecent)
          if (profile) {
            console.log('Found profile for', pubkey, 'from', relayUrl)

            // Cache the profile
            if (useCache) {
              profileCacheManager.setProfile(pubkey, profile)
            }

            return profile
          }
        }
      } catch (error) {
        console.error(`Error fetching from ${relayUrl}:`, error)
      }
    }

    return null
  } catch (error) {
    console.error('Failed to fetch profile:', error)
    return null
  }
}