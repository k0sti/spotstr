// Global type definitions

// NIP-07 types for window.nostr browser extension API
interface NostrEvent {
  id?: string
  pubkey?: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig?: string
}

interface Nostr {
  getPublicKey(): Promise<string>
  signEvent(event: NostrEvent): Promise<NostrEvent>

  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>
    decrypt(pubkey: string, ciphertext: string): Promise<string>
  }

  nip44?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>
    decrypt(pubkey: string, ciphertext: string): Promise<string>
  }
}

interface Window {
  nostr?: Nostr
}