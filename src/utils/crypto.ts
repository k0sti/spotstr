import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import * as nip19 from 'nostr-tools/nip19'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'

// Generate a new Nostr key pair using nostr-tools
export function generateNostrKeyPair() {
  const secretKey = generateSecretKey() // Uint8Array
  const publicKey = getPublicKey(secretKey) // hex string
  
  // Encode to bech32 format
  const nsec = nip19.nsecEncode(secretKey)
  const npub = nip19.npubEncode(publicKey)
  
  return {
    nsec,
    npub,
    secretKey,
    publicKey
  }
}

// Convert npub to hex public key
export function npubToHex(npub: string): string {
  try {
    const decoded = nip19.decode(npub)
    if (decoded.type === 'npub') {
      return decoded.data as string
    }
    throw new Error('Invalid npub')
  } catch {
    return ''
  }
}

// Convert hex public key to npub
export function hexToNpub(hex: string): string {
  try {
    return nip19.npubEncode(hex)
  } catch {
    return ''
  }
}

// Validate nsec key
export function validateNsec(nsec: string): boolean {
  try {
    const decoded = nip19.decode(nsec)
    return decoded.type === 'nsec'
  } catch {
    return false
  }
}

// Validate npub key
export function validateNpub(npub: string): boolean {
  try {
    const decoded = nip19.decode(npub)
    return decoded.type === 'npub'
  } catch {
    return false
  }
}

// Derive npub from nsec
export function deriveNpubFromNsec(nsec: string): string | null {
  try {
    const decoded = nip19.decode(nsec)
    if (decoded.type === 'nsec') {
      const secretKey = decoded.data as Uint8Array
      const publicKey = getPublicKey(secretKey)
      return nip19.npubEncode(publicKey)
    }
    return null
  } catch {
    return null
  }
}

// Generate geohash from coordinates
export function generateGeohash(lat: number, lng: number, precision: number = 8): string {
  // Simple geohash implementation for demo
  // In production, use a proper geohash library
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz'
  let idx = 0
  let bit = 0
  let evenBit = true
  let geohash = ''
  
  const latRange = [-90, 90]
  const lngRange = [-180, 180]
  
  while (geohash.length < precision) {
    if (evenBit) {
      const mid = (lngRange[0] + lngRange[1]) / 2
      if (lng > mid) {
        idx |= (1 << (4 - bit))
        lngRange[0] = mid
      } else {
        lngRange[1] = mid
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2
      if (lat > mid) {
        idx |= (1 << (4 - bit))
        latRange[0] = mid
      } else {
        latRange[1] = mid
      }
    }
    
    evenBit = !evenBit
    
    if (bit < 4) {
      bit++
    } else {
      geohash += base32[idx]
      bit = 0
      idx = 0
    }
  }
  
  return geohash
}

// Decode geohash to coordinates with bounding box
export function decodeGeohash(geohash: string): { lat: number, lng: number, bounds: { minLat: number, maxLat: number, minLng: number, maxLng: number } } | null {
  if (!geohash) return null
  
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz'
  let evenBit = true
  const latRange = [-90, 90]
  const lngRange = [-180, 180]
  
  for (let i = 0; i < geohash.length; i++) {
    const cd = base32.indexOf(geohash[i])
    if (cd === -1) return null
    
    for (let j = 4; j >= 0; j--) {
      const mask = 1 << j
      if (evenBit) {
        const mid = (lngRange[0] + lngRange[1]) / 2
        if (cd & mask) {
          lngRange[0] = mid
        } else {
          lngRange[1] = mid
        }
      } else {
        const mid = (latRange[0] + latRange[1]) / 2
        if (cd & mask) {
          latRange[0] = mid
        } else {
          latRange[1] = mid
        }
      }
      evenBit = !evenBit
    }
  }
  
  return {
    lat: (latRange[0] + latRange[1]) / 2,
    lng: (lngRange[0] + lngRange[1]) / 2,
    bounds: {
      minLat: latRange[0],
      maxLat: latRange[1],
      minLng: lngRange[0],
      maxLng: lngRange[1]
    }
  }
}

// Sign event with private key
export function signNostrEvent(eventTemplate: any, nsec: string) {
  try {
    const decoded = nip19.decode(nsec)
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid nsec')
    }
    
    const secretKey = decoded.data as Uint8Array
    const signedEvent = finalizeEvent(eventTemplate, secretKey)
    return signedEvent
  } catch (error) {
    console.error('Error signing event:', error)
    return null
  }
}

// Verify event signature
export function verifyNostrEvent(event: any): boolean {
  try {
    return verifyEvent(event)
  } catch {
    return false
  }
}