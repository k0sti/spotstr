import { BehaviorSubject } from 'rxjs'

export interface CachedProfile {
  pubkey: string
  name?: string
  display_name?: string
  picture?: string
  about?: string
  timestamp: number // When this was cached
}

class ProfileCacheManager {
  private STORAGE_KEY = 'spotstr_profile_cache'
  private CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
  private cache = new Map<string, CachedProfile>()
  public profileCache$ = new BehaviorSubject<Map<string, CachedProfile>>(new Map())

  constructor() {
    this.loadCache()
  }

  private loadCache() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored) as Record<string, CachedProfile>
        const now = Date.now()

        // Load non-expired entries into cache
        Object.entries(data).forEach(([pubkey, profile]) => {
          if (now - profile.timestamp < this.CACHE_DURATION) {
            this.cache.set(pubkey, profile)
          }
        })

        this.profileCache$.next(new Map(this.cache))
      }
    } catch (error) {
      console.error('Failed to load profile cache:', error)
    }
  }

  private saveCache() {
    try {
      const data: Record<string, CachedProfile> = {}
      this.cache.forEach((profile, pubkey) => {
        data[pubkey] = profile
      })
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save profile cache:', error)
    }
  }

  public getProfile(pubkey: string): CachedProfile | undefined {
    const profile = this.cache.get(pubkey)

    // Check if profile exists and is not expired
    if (profile) {
      const now = Date.now()
      if (now - profile.timestamp < this.CACHE_DURATION) {
        return profile
      } else {
        // Remove expired profile
        this.cache.delete(pubkey)
        this.saveCache()
      }
    }

    return undefined
  }

  public setProfile(pubkey: string, profileData: any) {
    const profile: CachedProfile = {
      pubkey,
      name: profileData.name,
      display_name: profileData.display_name,
      picture: profileData.picture,
      about: profileData.about,
      timestamp: Date.now()
    }

    this.cache.set(pubkey, profile)
    this.profileCache$.next(new Map(this.cache))
    this.saveCache()
  }

  public hasProfile(pubkey: string): boolean {
    const profile = this.getProfile(pubkey)
    return profile !== undefined
  }

  public clearExpired() {
    const now = Date.now()
    let changed = false

    this.cache.forEach((profile, pubkey) => {
      if (now - profile.timestamp >= this.CACHE_DURATION) {
        this.cache.delete(pubkey)
        changed = true
      }
    })

    if (changed) {
      this.profileCache$.next(new Map(this.cache))
      this.saveCache()
    }
  }

  public clearAll() {
    this.cache.clear()
    this.profileCache$.next(new Map())
    localStorage.removeItem(this.STORAGE_KEY)
  }

  public getCacheSize(): number {
    return this.cache.size
  }

  public getCacheAge(pubkey: string): number | undefined {
    const profile = this.cache.get(pubkey)
    if (profile) {
      return Date.now() - profile.timestamp
    }
    return undefined
  }
}

export const profileCacheManager = new ProfileCacheManager()