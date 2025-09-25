import { useEffect, useState } from 'react'
import { contactsManager, Contact } from '../services/contacts'

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])

  useEffect(() => {
    const subscription = contactsManager.contacts$.subscribe(contacts => {
      setContacts(contacts)
    })

    return () => subscription.unsubscribe()
  }, [])

  return {
    contacts,
    addContact: (npub: string, customName?: string) => contactsManager.addContact(npub, customName),
    addMultipleContacts: (npubList: string[]) => contactsManager.addMultipleContacts(npubList),
    deleteContact: (id: string) => contactsManager.deleteContact(id),
    updateContact: (id: string, updates: Partial<Contact>) => contactsManager.updateContact(id, updates),
    updateCustomName: (id: string, customName: string) => contactsManager.updateCustomName(id, customName),
    getContact: (id: string) => contactsManager.getContact(id)
  }
}