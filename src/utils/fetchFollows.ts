import { getProfileRelays } from './profileRelays'

// Fetch follow list for a given pubkey
export async function fetchFollowList(pubkey: string): Promise<string[]> {
  try {
    const relays = getProfileRelays()
    const { Relay } = await import('applesauce-relay')

    // Try each relay until we get a follow list
    for (const relayUrl of relays) {
      try {
        const relay = new Relay(relayUrl)

        // Request contact list events (kind 3)
        const events = await new Promise<any[]>((resolve) => {
          const collectedEvents: any[] = []
          const sub = relay.request({
            kinds: [3],
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
              relay.close()
              resolve(collectedEvents)
            },
            error: (error: any) => {
              console.error(`Failed to fetch from ${relayUrl}:`, error)
              relay.close()
              resolve(collectedEvents)
            }
          })

          // Timeout after 3 seconds
          setTimeout(() => {
            sub.unsubscribe()
            relay.close()
            resolve(collectedEvents)
          }, 3000)
        })

        // Find the most recent contact list event
        if (events.length > 0) {
          const mostRecent = events.reduce((prev, curr) =>
            curr.created_at > prev.created_at ? curr : prev
          )

          // Extract pubkeys from tags
          const follows: string[] = []
          if (mostRecent.tags) {
            for (const tag of mostRecent.tags) {
              if (tag[0] === 'p' && tag[1]) {
                follows.push(tag[1])
              }
            }
          }

          if (follows.length > 0) {
            console.log(`Found ${follows.length} follows for ${pubkey} from ${relayUrl}`)
            return follows
          }
        }
      } catch (error) {
        console.error(`Error fetching from ${relayUrl}:`, error)
      }
    }

    return []
  } catch (error) {
    console.error('Failed to fetch follow list:', error)
    return []
  }
}