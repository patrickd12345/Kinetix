import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type WeightSource = 'profile' | 'withings'

export interface WithingsCredentials {
  accessToken: string
  refreshToken: string
  userId: string
  expiresAt: number
}

export interface StravaCredentials {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

interface SettingsState {
  targetKPS: number
  setTargetKPS: (kps: number) => void
  /** Target % improvement over PB for "Beat PB" run suggestions (e.g. 2 = beat by 2%). */
  beatPBPercent: number
  setBeatPBPercent: (pct: number) => void
  /** Number of recent runs used for "Beat recents" (e.g. 10 = last 10 runs). */
  beatRecentsCount: number
  setBeatRecentsCount: (n: number) => void
  unitSystem: 'metric' | 'imperial'
  setUnitSystem: (unit: 'metric' | 'imperial') => void
  physioMode: boolean
  setPhysioMode: (enabled: boolean) => void
  stravaToken: string
  setStravaToken: (token: string) => void
  stravaCredentials: StravaCredentials | null
  setStravaCredentials: (creds: StravaCredentials | null) => void
  stravaSyncError: string | null
  setStravaSyncError: (msg: string | null) => void
  /** Set to true when persisted state has been rehydrated from storage (so Strava sync can run). */
  settingsRehydrated: boolean
  weightSource: WeightSource
  setWeightSource: (source: WeightSource) => void
  withingsCredentials: WithingsCredentials | null
  setWithingsCredentials: (creds: WithingsCredentials | null) => void
  lastWithingsWeightKg: number
  setLastWithingsWeightKg: (kg: number) => void
  /** Display unit for weight (weight history table, etc.). Default lbs. */
  weightUnit: 'kg' | 'lbs'
  setWeightUnit: (unit: 'kg' | 'lbs') => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      targetKPS: 135.0,
      setTargetKPS: (kps) => set({ targetKPS: kps }),

      beatPBPercent: 2,
      setBeatPBPercent: (pct) => set({ beatPBPercent: Math.max(0.1, Math.min(20, pct)) }),

      beatRecentsCount: 10,
      setBeatRecentsCount: (n) => set({ beatRecentsCount: Math.max(2, Math.min(50, n)) }),

      unitSystem: 'metric',
      setUnitSystem: (unit) => set({ unitSystem: unit }),

      physioMode: false,
      setPhysioMode: (enabled) => set({ physioMode: enabled }),

      stravaToken: '',
      setStravaToken: (token) => set({ stravaToken: token }),
      stravaCredentials: null,
      setStravaCredentials: (creds) => set({ stravaCredentials: creds, stravaSyncError: null }),
      stravaSyncError: null,
      setStravaSyncError: (msg) => set({ stravaSyncError: msg }),

      settingsRehydrated: false,

      weightSource: 'profile',
      setWeightSource: (source) => set({ weightSource: source }),

      withingsCredentials: null,
      setWithingsCredentials: (creds) => set({ withingsCredentials: creds }),

      lastWithingsWeightKg: 0,
      setLastWithingsWeightKg: (kg) => set({ lastWithingsWeightKg: kg }),

      weightUnit: 'lbs',
      setWeightUnit: (unit) => set({ weightUnit: unit }),
    }),
    {
      name: 'kinetix-settings',
      partialize: (state) => {
        const { settingsRehydrated: _rehydrated, ...rest } = state
        void _rehydrated
        return rest
      },
      merge: (persisted, current) => {
        const p = persisted as (Partial<SettingsState> & { targetNPI?: number }) | undefined
        if (!p) return current
        const out: SettingsState = { ...current, ...p }
        if (p.targetNPI !== undefined) out.targetKPS = p.targetNPI
        if (p.withingsCredentials && typeof p.withingsCredentials.expiresAt === 'number') out.withingsCredentials = p.withingsCredentials
        if (p.stravaCredentials && typeof p.stravaCredentials.expiresAt === 'number') out.stravaCredentials = p.stravaCredentials
        out.stravaSyncError = null
        return out
      },
      onRehydrateStorage: () => (state, err) => {
        if (!err && state) useSettingsStore.setState({ settingsRehydrated: true })
      },
    }
  )
)
