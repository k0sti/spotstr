import { useEffect, useState } from 'react'
import { accountCustomNamesManager } from '../services/accountCustomNames'

export function useAccountCustomNames() {
  const [customNames, setCustomNames] = useState<{ [pubkey: string]: string }>({})

  useEffect(() => {
    const subscription = accountCustomNamesManager.customNames$.subscribe(names => {
      setCustomNames(names)
    })

    return () => subscription.unsubscribe()
  }, [])

  return {
    customNames,
    getCustomName: (pubkey: string) => accountCustomNamesManager.getCustomName(pubkey),
    setCustomName: (pubkey: string, name: string) => accountCustomNamesManager.setCustomName(pubkey, name),
    removeCustomName: (pubkey: string) => accountCustomNamesManager.removeCustomName(pubkey)
  }
}