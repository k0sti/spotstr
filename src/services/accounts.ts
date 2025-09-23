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
const ACTIVE_ACCOUNT_KEY = 'spotstr_active_account'

// Load saved accounts
const loadAccounts = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as SerializedAccount<any, any>[]
      accounts.fromJSON(parsed, true)
    }

    // Load active account
    const activeAccountPubkey = localStorage.getItem(ACTIVE_ACCOUNT_KEY)
    if (activeAccountPubkey) {
      const account = accounts.accounts.find(a => a.pubkey === activeAccountPubkey)
      if (account) accounts.setActive(account)
    }
  } catch (error) {
    console.error('Failed to load accounts:', error)
  }
}

// Save accounts when they change
accounts.accounts$.pipe(skip(1)).subscribe(async () => {
  const json = accounts.toJSON()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(json))
})

// Save active account when it changes
accounts.active$.pipe(skip(1)).subscribe((account: any) => {
  if (account) {
    localStorage.setItem(ACTIVE_ACCOUNT_KEY, account.pubkey)
  } else {
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY)
  }
})

// Load accounts on initialization
loadAccounts()

export default accounts