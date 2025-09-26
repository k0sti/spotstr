import { useEffect, useState } from 'react'
import { groupCustomNamesManager } from '../services/groupCustomNames'

export function useGroupCustomNames() {
  const [customNames, setCustomNames] = useState<{ [groupId: string]: string }>({})

  useEffect(() => {
    const subscription = groupCustomNamesManager.customNames$.subscribe(names => {
      setCustomNames(names)
    })

    return () => subscription.unsubscribe()
  }, [])

  return {
    customNames,
    getCustomName: (groupId: string) => groupCustomNamesManager.getCustomName(groupId),
    setCustomName: (groupId: string, name: string) => groupCustomNamesManager.setCustomName(groupId, name),
    removeCustomName: (groupId: string) => groupCustomNamesManager.removeCustomName(groupId)
  }
}