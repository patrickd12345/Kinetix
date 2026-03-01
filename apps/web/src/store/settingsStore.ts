import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type WeightSource = 'profile' | 'withings'

export interface WithingsCredentials {
  accessToken: string
  refreshToken: string
  userId: string
  expiresAt: number
}

interface SettingsState {
  targetKPS: number
  setTargetKPS: (kps: number) => void
  /** Target % improvement over PB for "Beat PB" run suggestions (e.g. 2 = beat by 2%). */
  beatPBPercent: number
  setBeatPBPercent: (pct: number) => void
  unitSystem: 'metric' | 'imperial'
  setUnitSystem: (unit: 'metric' | 'imperial') => void
  physioMode: boolean
  setPhysioMode: (enabled: boolean) => void
  stravaToken: string
  setStravaToken: (token: string) => void
  weightSource: WeightSource
  setWeightSource: (source: WeightSource) => void
  withingsCredentials: WithingsCredentials | null
  setWithingsCredentials: (creds: WithingsCredentials | null) => void
  lastWithingsWeightKg: number
  setLastWithingsWeightKg: (kg: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      targetKPS: 135.0,
      setTargetKPS: (kps) => set({ targetKPS: kps }),

      beatPBPercent: 2,
      setBeatPBPercent: (pct) => set({ beatPBPercent: Math.max(0.1, Math.min(20, pct)) }),

      unitSystem: 'metric',
      setUnitSystem: (unit) => set({ unitSystem: unit }),

      physioMode: false,
      setPhysioMode: (enabled) => set({ physioMode: enabled }),

      stravaToken: '',
      setStravaToken: (token) => set({ stravaToken: token }),

      weightSource: 'profile',
      setWeightSource: (source) => set({ weightSource: source }),

      withingsCredentials: null,
      setWithingsCredentials: (creds) => set({ withingsCredentials: creds }),

      lastWithingsWeightKg: 0,
      setLastWithingsWeightKg: (kg) => set({ lastWithingsWeightKg: kg }),
    }),
    {
      name: 'kinetix-settings',
      merge: (persisted, current) => {
        const p = persisted as (Partial<SettingsState> & { targetNPI?: number }) | undefined
        if (!p) return current
        const out: SettingsState = { ...current, ...p }
        if (p.targetNPI !== undefined) out.targetKPS = p.targetNPI
        if (p.withingsCredentials && typeof p.withingsCredentials.expiresAt === 'number') out.withingsCredentials = p.withingsCredentials
        return out
      },
    }
  )
)
