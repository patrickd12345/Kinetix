import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { UserProfile } from '@kinetix/core'

interface SettingsState {
  userProfile: UserProfile
  setUserProfile: (profile: UserProfile) => void
  targetNPI: number
  setTargetNPI: (npi: number) => void
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

      targetNPI: 135.0,
      setTargetNPI: (npi) => set({ targetNPI: npi }),

      unitSystem: 'metric',
      setUnitSystem: (unit) => set({ unitSystem: unit }),

      physioMode: false,
      setPhysioMode: (enabled) => set({ physioMode: enabled }),

      stravaToken: '',
      setStravaToken: (token) => set({ stravaToken: token }),
    }),
    {
      name: 'kinetix-settings',
    }
  )
)
