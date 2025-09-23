import { AccountManager, SerializedAccount } from "applesauce-accounts"
import {
  AmberClipboardAccount,
  PasswordAccount,
  registerCommonAccountTypes
} from "applesauce-accounts/accounts"
import { NostrConnectSigner } from "applesauce-signers"
import { skip } from "rxjs"
import { Observable } from "rxjs"
import { Relay } from "applesauce-relay"

// Setup NostrConnect signer methods
NostrConnectSigner.subscriptionMethod = (relays: string[], filters: any[]) => {
  return new Observable((observer: any) => {
    const relay = new Relay(relays[0])
    const sub = relay.req(filters).subscribe({
      next: (event: any) => {
        if (event !== 'EOSE') {
          observer.next(event)
        }
      },
      error: (err: any) => observer.error(err),
      complete: () => observer.complete(),
    })
    return () => {
      sub.unsubscribe()
      relay.close()
    }
  })
}

NostrConnectSigner.publishMethod = async (relays: string[], event: any) => {
  for (const relayUrl of relays) {
    const relay = new Relay(relayUrl)
    await relay.publish(event)
    relay.close()
  }
}

// Create account manager
const accounts = new AccountManager()

// Register account types
registerCommonAccountTypes(accounts)
accounts.registerType(AmberClipboardAccount)

// Setup password unlock prompt
PasswordAccount.requestUnlockPassword = async () => {
  const password = window.prompt("Account unlock password")
  if (!password) throw new Error("Password required")
  return password
}

// Load accounts from localStorage
const STORAGE_KEY = 'spotstr_accounts'

// Load saved accounts
const loadAccounts = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as SerializedAccount<any, any>[]
      accounts.fromJSON(parsed, true)
    }

    // No active account needed - multi-account support
  } catch (error) {
    console.error('Failed to load accounts:', error)
  }
}

// Save accounts when they change
accounts.accounts$.pipe(skip(1)).subscribe(async () => {
  const json = accounts.toJSON()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(json))
})

// No active account tracking needed

// Load accounts on initialization
loadAccounts()

export default accounts