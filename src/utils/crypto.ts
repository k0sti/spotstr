// Simplified crypto utilities for demo
// In production, would use proper Nostr key generation and signing

export function generateNostrKeyPair() {
  // Simplified - would use secp256k1 in production
  // Generate mock keys that match proper bech32 length
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz'
  const generateKey = (length: number) => {
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }
  
  // Bech32 encoded keys are typically 58 chars after the prefix
  const privateKey = generateKey(58)
  const publicKey = generateKey(58)
  
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
  // Valid nsec should start with nsec1 and be 63 characters long (bech32 encoded)
  return nsec.startsWith('nsec1') && nsec.length >= 63 && nsec.length <= 64
}

export function validateNpub(npub: string): boolean {
  // Valid npub should start with npub1 and be 63 characters long (bech32 encoded)
  return npub.startsWith('npub1') && npub.length >= 63 && npub.length <= 64
}

export function generateGeohash(lat: number, lng: number, precision: number = 8): string {
  // Simplified geohash generation for demo purposes
  return `${lat.toFixed(3)}${lng.toFixed(3)}`.replace(/[-.]/g, '').slice(0, precision)
}