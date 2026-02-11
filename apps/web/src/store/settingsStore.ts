import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { UserProfile } from '@kinetix/core'

interface SettingsState {
  userProfile: UserProfile
  setUserProfile: (profile: UserProfile) => void
  targetKPS: number
  setTargetKPS: (kps: number) => void
  unitSystem: 'metric' | 'imperial'
  setUnitSystem: (unit: 'metric' | 'imperial') => void
  physioMode: boolean
  setPhysioMode: (enabled: boolean) => void
  stravaToken: string
  setStravaToken: (token: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      userProfile: {
        age: 30,
        weightKg: 70,
      },
      setUserProfile: (profile) => set({ userProfile: profile }),

      targetKPS: 135.0,
      setTargetKPS: (kps) => set({ targetKPS: kps }),

      unitSystem: 'metric',
      setUnitSystem: (unit) => set({ unitSystem: unit }),

      physioMode: false,
      setPhysioMode: (enabled) => set({ physioMode: enabled }),

      stravaToken: '',
      setStravaToken: (token) => set({ stravaToken: token }),
    }),
    {
      name: 'kinetix-settings',
      merge: (persisted, current) => {
        const p = persisted as (Partial<SettingsState> & { targetNPI?: number }) | undefined
        if (!p) return current
        const out: SettingsState = { ...current, ...p }
        if (p.targetNPI !== undefined) out.targetKPS = p.targetNPI
        return out
      },
    }
  )
)
