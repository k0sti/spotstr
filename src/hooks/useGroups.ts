import { useEffect, useState } from 'react'
import { groupsManager, Group } from '../services/groups'

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([])

  useEffect(() => {
    const subscription = groupsManager.groups$.subscribe(groups => {
      setGroups(groups)
    })

    return () => subscription.unsubscribe()
  }, [])

  return {
    groups,
    generateGroup: (name: string) => groupsManager.generateGroup(name),
    importFromNsec: (name: string, nsec: string) => groupsManager.importFromNsec(name, nsec),
    importFromUrl: (params: URLSearchParams) => groupsManager.importFromUrl(params),
    deleteGroup: (id: string) => groupsManager.deleteGroup(id),
    updateGroup: (id: string, updates: Partial<Group>) => groupsManager.updateGroup(id, updates),
    getGroup: (id: string) => groupsManager.getGroup(id),
    generateShareUrl: (group: Group) => groupsManager.generateShareUrl(group)
  }
}