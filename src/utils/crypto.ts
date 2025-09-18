// Simplified crypto utilities for demo
// In production, would use proper Nostr key generation and signing

export function generateNostrKeyPair() {
  // Simplified - would use secp256k1 in production
  const privateKey = crypto.randomUUID().replace(/-/g, '').slice(0, 32)
  const publicKey = crypto.randomUUID().replace(/-/g, '').slice(0, 32)
  
  return {
    nsec: `nsec1${privateKey}`,
    npub: `npub1${publicKey}`,
  }
}

export function npubToHex(npub: string): string {
  // Simplified conversion
  return npub.replace('npub1', '')
}

export function hexToNpub(hex: string): string {
  return `npub1${hex}`
}

export function validateNsec(nsec: string): boolean {
  return nsec.startsWith('nsec1') && nsec.length === 37
}

export function validateNpub(npub: string): boolean {
  return npub.startsWith('npub1') && npub.length === 37
}

export function generateGeohash(lat: number, lng: number, precision: number = 8): string {
  // Simplified geohash generation for demo purposes
  return `${lat.toFixed(3)}${lng.toFixed(3)}`.replace(/[-.]/g, '').slice(0, precision)
}