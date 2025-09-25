import { BehaviorSubject } from 'rxjs'

interface AccountCustomNames {
  [pubkey: string]: string
}

class AccountCustomNamesManager {
  private STORAGE_KEY = 'spotstr_account_custom_names'
  public customNames$ = new BehaviorSubject<AccountCustomNames>({})

  constructor() {
    this.loadCustomNames()
  }

  private loadCustomNames() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const customNames = JSON.parse(stored) as AccountCustomNames
        this.customNames$.next(customNames)
      }
    } catch (error) {
      console.error('Failed to load account custom names:', error)
    }
  }

  private saveCustomNames() {
    const customNames = this.customNames$.value
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(customNames))
  }

  public getCustomName(pubkey: string): string | undefined {
    return this.customNames$.value[pubkey]
  }

  public setCustomName(pubkey: string, name: string) {
    const currentNames = this.customNames$.value
    if (name.trim()) {
      currentNames[pubkey] = name.trim()
    } else {
      delete currentNames[pubkey]
    }
    this.customNames$.next({ ...currentNames })
    this.saveCustomNames()
  }

  public removeCustomName(pubkey: string) {
    const currentNames = this.customNames$.value
    delete currentNames[pubkey]
    this.customNames$.next({ ...currentNames })
    this.saveCustomNames()
  }
}

export const accountCustomNamesManager = new AccountCustomNamesManager()