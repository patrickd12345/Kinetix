import { useEffect, useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { applyResolvedTheme, type ThemePreference, useThemeStore } from '../store/themeStore'

function subscribeSystemTheme(onStoreChange: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onStoreChange)
  return () => mq.removeEventListener('change', onStoreChange)
}

function getSystemSnapshot(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function ThemeSelector() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  const systemResolved = useSyncExternalStore(subscribeSystemTheme, getSystemSnapshot, () => 'dark')

  useEffect(() => {
    const resolved =
      theme === 'system' ? (systemResolved === 'dark' ? 'dark' : 'light') : theme === 'dark' ? 'dark' : 'light'
    applyResolvedTheme(resolved)
  }, [theme, systemResolved])

  const items: { value: ThemePreference; icon: typeof Monitor; label: string }[] = [
    { value: 'system', icon: Monitor, label: 'System theme' },
    { value: 'light', icon: Sun, label: 'Light theme' },
    { value: 'dark', icon: Moon, label: 'Dark theme' },
  ]

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-slate-300/25 bg-slate-200/40 p-0.5 dark:border-white/10 dark:bg-white/[0.08]"
      role="group"
      aria-label="Color theme"
    >
      {items.map(({ value, icon: Icon, label }) => {
        const selected = theme === value
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={selected}
            onClick={() => setTheme(value)}
            className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              selected
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {selected ? (
              <span
                className="absolute inset-0.5 rounded-full bg-rose-500/25 dark:bg-rose-900/50"
                aria-hidden
              />
            ) : null}
            <Icon className="relative z-10" size={16} strokeWidth={1.75} />
          </button>
        )
      })}
    </div>
  )
}
