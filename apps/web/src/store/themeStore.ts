import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'kinetix-theme'

export function getResolvedTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export function applyResolvedTheme(resolved: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

/** Run before React paint to reduce theme flash (matches zustand persist shape). */
export function hydrateThemeClassFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      applyResolvedTheme(
        window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      )
      return
    }
    const parsed = JSON.parse(raw) as { state?: { theme?: ThemePreference } }
    const pref = parsed.state?.theme
    const valid = pref === 'light' || pref === 'dark' || pref === 'system' ? pref : 'system'
    applyResolvedTheme(getResolvedTheme(valid))
  } catch {
    applyResolvedTheme(
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    )
  }
}

interface ThemeState {
  theme: ThemePreference
  setTheme: (t: ThemePreference) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: STORAGE_KEY,
    }
  )
)
