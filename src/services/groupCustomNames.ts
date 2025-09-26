import { BehaviorSubject } from 'rxjs'

interface GroupCustomNames {
  [groupId: string]: string
}

class GroupCustomNamesManager {
  private STORAGE_KEY = 'spotstr_group_custom_names'
  public customNames$ = new BehaviorSubject<GroupCustomNames>({})

  constructor() {
    this.loadCustomNames()
  }

  private loadCustomNames() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const customNames = JSON.parse(stored) as GroupCustomNames
        this.customNames$.next(customNames)
      }
    } catch (error) {
      console.error('Failed to load group custom names:', error)
    }
  }

  private saveCustomNames() {
    const customNames = this.customNames$.value
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(customNames))
  }

  public getCustomName(groupId: string): string | undefined {
    return this.customNames$.value[groupId]
  }

  public setCustomName(groupId: string, name: string) {
    const currentNames = this.customNames$.value
    if (name.trim()) {
      currentNames[groupId] = name.trim()
    } else {
      delete currentNames[groupId]
    }
    this.customNames$.next({ ...currentNames })
    this.saveCustomNames()
  }

  public removeCustomName(groupId: string) {
    const currentNames = this.customNames$.value
    delete currentNames[groupId]
    this.customNames$.next({ ...currentNames })
    this.saveCustomNames()
  }
}

export const groupCustomNamesManager = new GroupCustomNamesManager()