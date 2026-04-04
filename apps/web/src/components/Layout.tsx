import { ReactNode, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Activity, History, MessageCircle, Settings, Scale, BarChart3, HelpCircle } from 'lucide-react'
import { useAuth } from './providers/useAuth'
import { useSettingsStore } from '../store/settingsStore'
import { getProfileLabel, toKinetixUserProfile } from '../lib/kinetixProfile'
import { getRunsPage } from '../lib/database'
import { syncNewRunsToRAG } from '../lib/ragClient'
import { syncStravaRuns, getValidStravaToken } from '../lib/strava'
import { syncWithingsWeightsAtStartup, WITHINGS_WEIGHTS_SYNCED_EVENT } from '../lib/withings'
import { scheduleStartupAttempts } from '../lib/startupOrchestrator'

const RAG_SYNC_PAGE_SIZE = 200
const STRAVA_STARTUP_RETRY_DELAYS_MS = [0, 500, 1500, 2500, 4000, 5000] as const
const WITHINGS_STARTUP_RETRY_DELAYS_MS = [0, 1500, 4000, 8000, 12000] as const

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { profile, session, signOut } = useAuth()
  const {
    stravaCredentials,
    stravaToken,
    targetKPS,
    setStravaSyncError,
    settingsRehydrated,
    withingsCredentials,
    setWithingsCredentials,
    setLastWithingsWeightKg,
  } = useSettingsStore()
  const profileLabel = profile ? getProfileLabel(profile, session?.user.email ?? null) : session?.user.email ?? 'User'

  useEffect(() => {
    if (!profile || typeof indexedDB === 'undefined') return
    const userProfile = toKinetixUserProfile(profile)
    const run = async () => {
      getRunsPage(1, RAG_SYNC_PAGE_SIZE)
        .then(({ items }) => {
          if (items.length === 0) return
          syncNewRunsToRAG(items, userProfile).catch(() => {})
        })
        .catch(() => {})
      return true
    }
    return scheduleStartupAttempts([0], run)
  }, [profile])

  // Sync new runs from Strava on app startup (e.g. Garmin->Strava run).
  // Uses persisted credentials (with refresh) or legacy token. Runs at 0, 500, 1500, 2500, 4000, 5000 ms
  // so that Zustand persist rehydration (async) has time to restore stravaCredentials.
  const stravaSyncDoneRef = useRef(false)
  useEffect(() => {
    if (!profile || typeof indexedDB === 'undefined') return
    stravaSyncDoneRef.current = false

    const runSync = async (attempt: number) => {
      if (stravaSyncDoneRef.current) return true
      const token = await getValidStravaToken()
      if (!token?.trim()) {
        const isLastAttempt = attempt === STRAVA_STARTUP_RETRY_DELAYS_MS.length - 1
        if (
          isLastAttempt &&
          (useSettingsStore.getState().stravaCredentials ?? useSettingsStore.getState().stravaToken?.trim())
        ) {
          console.log('[Strava] Startup sync skipped: no valid token yet (refresh may have failed or rehydration pending)')
        }
        return false
      }
      stravaSyncDoneRef.current = true
      console.log('[Strava] Startup sync running...')
      try {
        const r = await syncStravaRuns(token, targetKPS, { recentDays: 90 })
        if (r.added.length > 0) {
          console.log('[Strava] Imported', r.added.length, 'run(s) on startup')
          setStravaSyncError(null)
        }
        if (r.error) setStravaSyncError(r.error)
      } catch (e) {
        setStravaSyncError(e instanceof Error ? e.message : 'Strava sync failed')
      }
      return true
    }
    return scheduleStartupAttempts([...STRAVA_STARTUP_RETRY_DELAYS_MS], runSync)
  }, [profile, stravaCredentials, stravaToken, targetKPS, setStravaSyncError, settingsRehydrated])

  // Background Withings sync on startup: token refresh, recent history → IndexedDB, latest weight → settings.
  const withingsWeightSyncDoneRef = useRef(false)
  const withingsCredsKeyRef = useRef<string | null>(null)
  useEffect(() => {
    const key = withingsCredentials?.refreshToken ?? ''
    if (key !== withingsCredsKeyRef.current) {
      withingsCredsKeyRef.current = key || null
      withingsWeightSyncDoneRef.current = false
    }
  }, [withingsCredentials?.refreshToken])

  useEffect(() => {
    if (!settingsRehydrated || !withingsCredentials || typeof indexedDB === 'undefined') {
      return
    }
    if (withingsWeightSyncDoneRef.current) {
      return
    }

    const run = async () => {
      if (withingsWeightSyncDoneRef.current) return true
      try {
        const { latestKg, historyEntriesSynced } = await syncWithingsWeightsAtStartup(
          withingsCredentials,
          (c) => setWithingsCredentials(c)
        )
        if (latestKg != null) setLastWithingsWeightKg(latestKg)
        if (historyEntriesSynced > 0) {
          console.log('[Withings] Synced', historyEntriesSynced, 'weight row(s) into history')
        } else if (latestKg != null) {
          console.log('[Withings] Latest weight updated:', latestKg.toFixed(1), 'kg')
        }
        window.dispatchEvent(new CustomEvent(WITHINGS_WEIGHTS_SYNCED_EVENT))
        withingsWeightSyncDoneRef.current = true
        return true
      } catch (e) {
        console.warn('[Withings] Startup sync failed:', e instanceof Error ? e.message : e)
        return false
      }
    }
    return scheduleStartupAttempts([...WITHINGS_STARTUP_RETRY_DELAYS_MS], run)
  }, [settingsRehydrated, withingsCredentials, setWithingsCredentials, setLastWithingsWeightKg])

  const navItems = [
    { path: '/', icon: Activity, label: 'Run' },
    { path: '/history', icon: History, label: 'History' },
    { path: '/weight-history', icon: Scale, label: 'Weight' },
    { path: '/menu', icon: BarChart3, label: 'Charts' },
    { path: '/chat', icon: MessageCircle, label: 'Chat' },
    { path: '/help', icon: HelpCircle, label: 'Help' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-black text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-black tracking-wide">KINETIX</h1>
              <p className="text-xs text-slate-400">Web dashboard</p>
            </div>
            <div className="hidden md:flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-all ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:block max-w-[180px] truncate text-xs text-slate-400">
                {profileLabel}
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-md border border-cyan-500/30 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/10"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px,1fr]">
          <aside className="hidden lg:block">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.path
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>
          </aside>
          <main className="min-w-0">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 backdrop-blur md:hidden">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-around px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 rounded px-2 py-1 text-[10px] ${
                  isActive ? 'text-cyan-300' : 'text-slate-400'
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
