import { BehaviorSubject } from 'rxjs'
import { generateNostrKeyPair, getPublicKeyFromNsec, validateNsec } from '../utils/crypto'
import * as nip19 from 'nostr-tools/nip19'

export interface Group {
  id: string
  name: string
  nsec: string
  npub: string
  createdAt: number
  metadata?: {
    picture?: string
    about?: string
    [key: string]: any
  }
}

class GroupsManager {
  private STORAGE_KEY = 'spotstr_groups'
  public groups$ = new BehaviorSubject<Group[]>([])

  constructor() {
    this.loadGroups()
  }

  private loadGroups() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const groups = JSON.parse(stored) as Group[]
        this.groups$.next(groups)
      }
    } catch (error) {
      console.error('Failed to load groups:', error)
    }
  }

  private saveGroups() {
    const groups = this.groups$.value
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(groups))
  }

  public generateGroup(name: string): Group {
    const { nsec, npub } = generateNostrKeyPair()
    const group: Group = {
      id: npub,
      name,
      nsec,
      npub,
      createdAt: Date.now()
    }

    const currentGroups = this.groups$.value
    this.groups$.next([...currentGroups, group])
    this.saveGroups()

    return group
  }

  public importFromNsec(name: string, nsec: string): Group | null {
    if (!validateNsec(nsec)) {
      return null
    }

    const pubkey = getPublicKeyFromNsec(nsec)
    if (!pubkey) {
      return null
    }

    const npub = nip19.npubEncode(pubkey)

    // Check if group already exists
    const existingGroups = this.groups$.value
    if (existingGroups.some(g => g.npub === npub)) {
      return null // Group already exists
    }

    const group: Group = {
      id: npub,
      name,
      nsec,
      npub,
      createdAt: Date.now()
    }

    this.groups$.next([...existingGroups, group])
    this.saveGroups()

    return group
  }

  public importFromUrl(params: URLSearchParams): Group | null {
    const hexNsec = params.get('g')
    const name = params.get('n') || 'Imported Group'

    if (!hexNsec) {
      return null
    }

    try {
      // Convert hex to Uint8Array
      const secretKey = new Uint8Array(
        hexNsec.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      )

      // Encode to nsec
      const nsec = nip19.nsecEncode(secretKey)

      return this.importFromNsec(name, nsec)
    } catch (error) {
      console.error('Failed to import group from URL:', error)
      return null
    }
  }

  public deleteGroup(id: string) {
    const currentGroups = this.groups$.value
    const updatedGroups = currentGroups.filter(g => g.id !== id)
    this.groups$.next(updatedGroups)
    this.saveGroups()
  }

  public updateGroup(id: string, updates: Partial<Group>) {
    const currentGroups = this.groups$.value
    const updatedGroups = currentGroups.map(g =>
      g.id === id ? { ...g, ...updates } : g
    )
    this.groups$.next(updatedGroups)
    this.saveGroups()
  }

  public getGroup(id: string): Group | undefined {
    return this.groups$.value.find(g => g.id === id)
  }

  public generateShareUrl(group: Group): string {
    // Convert nsec to hex for URL
    const decoded = nip19.decode(group.nsec)
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid nsec')
    }

    const secretKey = decoded.data as Uint8Array
    const hexNsec = Array.from(secretKey)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const url = new URL(window.location.origin)
    url.searchParams.set('g', hexNsec)
    url.searchParams.set('n', group.name)

    return url.toString()
  }
}

export const groupsManager = new GroupsManager()