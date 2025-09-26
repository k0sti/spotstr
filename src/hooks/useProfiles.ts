import { useEffect, useState } from 'react'
import { profileCacheManager, CachedProfile } from '../services/profileCache'
import { fetchProfile } from '../utils/profileRelays'
import * as nip19 from 'nostr-tools/nip19'

export function useProfiles(npubs: string[]) {
  const [profiles, setProfiles] = useState<Map<string, CachedProfile>>(new Map())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Subscribe to profile cache changes
    const subscription = profileCacheManager.profileCache$.subscribe((cache) => {
      setProfiles(new Map(cache))
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!npubs || npubs.length === 0) return

    const fetchMissingProfiles = async () => {
      const uniqueNpubs = [...new Set(npubs)]
      const toFetch: string[] = []

      for (const npub of uniqueNpubs) {
        if (!npub) continue

        // Convert npub to hex if needed
        let pubkey = npub
        if (npub.startsWith('npub')) {
          try {
            pubkey = nip19.decode(npub).data as string
          } catch (e) {
            console.error('Failed to decode npub:', npub, e)
            continue
          }
        }

        // Check if profile is already cached
        if (!profileCacheManager.hasProfile(pubkey)) {
          toFetch.push(pubkey)
        }
      }

      if (toFetch.length === 0) return

      setLoading(true)

      // Fetch profiles in parallel with a limit
      const BATCH_SIZE = 5
      for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
        const batch = toFetch.slice(i, i + BATCH_SIZE)
        await Promise.all(
          batch.map(async (pubkey) => {
            try {
              await fetchProfile(pubkey)
            } catch (e) {
              console.error('Failed to fetch profile:', pubkey, e)
            }
          })
        )
      }

      setLoading(false)
    }

    fetchMissingProfiles()
  }, [npubs])

  return { profiles, loading }
}

// Helper function to get profile for a specific npub
export function getProfileFromCache(npub: string): CachedProfile | undefined {
  if (!npub) return undefined

  // Convert npub to hex if needed
  let pubkey = npub
  if (npub.startsWith('npub')) {
    try {
      pubkey = nip19.decode(npub).data as string
    } catch (e) {
      console.error('Failed to decode npub:', npub, e)
      return undefined
    }
  }

  return profileCacheManager.getProfile(pubkey)
}