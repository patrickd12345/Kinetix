import type { StateStorage } from 'zustand/middleware'
import { scopedSettingsLocalStorageKey } from '../lib/clientStorageScope'

/** Active auth user id for Zustand settings persist (must match scoped localStorage blob). */
let settingsPersistUserId: string | null = null

export function setSettingsPersistUserId(id: string | null): void {
  settingsPersistUserId = id
}

export function getSettingsPersistUserId(): string | null {
  return settingsPersistUserId
}

export const scopedSettingsStorage: StateStorage = {
  getItem: (_name: string): string | null => {
    if (typeof localStorage === 'undefined') return null
    const id = settingsPersistUserId
    if (!id) return null
    return localStorage.getItem(scopedSettingsLocalStorageKey(id))
  },
  setItem: (_name: string, value: string): void => {
    if (typeof localStorage === 'undefined') return
    const id = settingsPersistUserId
    if (!id) return
    localStorage.setItem(scopedSettingsLocalStorageKey(id), value)
  },
  removeItem: (_name: string): void => {
    if (typeof localStorage === 'undefined') return
    const id = settingsPersistUserId
    if (!id) return
    localStorage.removeItem(scopedSettingsLocalStorageKey(id))
  },
}
