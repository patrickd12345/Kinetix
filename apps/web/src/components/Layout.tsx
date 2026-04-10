import { ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Activity,
  History,
  MessageCircle,
  Settings,
  Scale,
  BarChart3,
  HelpCircle,
  ShieldCheck,
  LayoutDashboard,
  Brain,
  MoreHorizontal,
} from 'lucide-react'
import { useAuth } from './providers/useAuth'
import { useSettingsStore } from '../store/settingsStore'
import { getProfileLabel, toKinetixUserProfile } from '../lib/kinetixProfile'
import { getRunsPage } from '../lib/database'
import { syncNewRunsToRAG } from '../lib/ragClient'
import { syncStravaRuns, getValidStravaToken } from '../lib/strava'
import { scheduleStartupAttempts } from '../lib/startupOrchestrator'
import ThemeSelector from './ThemeSelector'
import AdSenseDisplayUnit from './ads/AdSenseDisplayUnit'
import WithingsSyncPrompt from './WithingsSyncPrompt'
import { Dialog } from './a11y/Dialog'

const RAG_SYNC_PAGE_SIZE = 200
const STRAVA_STARTUP_RETRY_DELAYS_MS = [0, 500, 1500, 2500, 4000, 5000] as const

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { profile, session, signOut } = useAuth()
  const [mobileOverflowOpen, setMobileOverflowOpen] = useState(false)
  const {
    stravaCredentials,
    stravaToken,
    targetKPS,
    setStravaSyncError,
    settingsRehydrated,
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

  const navItems = [
    { path: '/', icon: Activity, label: 'Run' },
    { path: '/history', icon: History, label: 'History' },
    { path: '/coaching', icon: Brain, label: 'Coaching' },
    { path: '/weight-history', icon: Scale, label: 'Weight' },
    { path: '/menu', icon: BarChart3, label: 'Charts' },
    { path: '/chat', icon: MessageCircle, label: 'Chat' },
    { path: '/help', icon: HelpCircle, label: 'Help' },
    { path: '/operator', icon: LayoutDashboard, label: 'Operator' },
    { path: '/support-queue', icon: ShieldCheck, label: 'Queue' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ]
  const mobilePrimaryNavItems = navItems.filter((item) =>
    ['/', '/history', '/coaching', '/chat', '/help'].includes(item.path),
  )
  const mobileOverflowNavItems = navItems.filter((item) => !mobilePrimaryNavItems.some((navItem) => navItem.path === item.path))
  const mobileOverflowActive = mobileOverflowNavItems.some((item) => location.pathname === item.path)

  useEffect(() => {
    setMobileOverflowOpen(false)
  }, [location.pathname])

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 text-[var(--shell-text-primary)] dark:from-slate-950 dark:to-black dark:text-[var(--shell-text-primary)]">
      <a
        href="#main-content"
        className="shell-focus-ring absolute left-4 top-3 z-[60] -translate-y-[140%] rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-slate-950/90">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Link
                to="/"
                className="shell-focus-ring block rounded-md"
              >
                <h1 className="text-xl font-black tracking-wide text-[var(--shell-text-primary)] dark:text-[var(--shell-text-primary)]">KINETIX</h1>
                <p className="text-xs text-[var(--shell-text-tertiary)] dark:text-[var(--shell-text-tertiary)]">Web dashboard</p>
              </Link>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <ThemeSelector />
              <span className="hidden max-w-[180px] truncate text-xs text-[var(--shell-text-secondary)] sm:block dark:text-[var(--shell-text-secondary)]">
                {profileLabel}
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="shell-focus-ring rounded-md border border-cyan-700/35 px-3 py-1.5 text-xs font-medium text-cyan-950 hover:bg-cyan-500/12 dark:border-cyan-400/35 dark:text-cyan-100 dark:hover:bg-cyan-500/14"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px,1fr]">
          <aside className="hidden md:block">
            <div className="rounded-xl border border-slate-200/90 bg-white/80 p-2 shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
              <nav className="space-y-1" aria-label="Primary navigation">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.path
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-current={isActive ? 'page' : undefined}
                      data-testid={isActive ? 'shell-nav-active' : undefined}
                      className={`shell-focus-ring flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? 'shell-nav-active shadow-sm'
                          : 'shell-nav-inactive dark:hover:bg-white/10'
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
          <main id="main-content" className="min-w-0 text-[var(--shell-text-primary)] dark:text-[var(--shell-text-primary)]" tabIndex={-1}>
            <WithingsSyncPrompt />
            {children}
            <AdSenseDisplayUnit />
          </main>
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-slate-950/95 md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-around px-2">
          {mobilePrimaryNavItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                data-testid={isActive ? 'shell-nav-active-mobile' : undefined}
                className={`shell-focus-ring flex min-w-0 flex-col items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium ${
                  isActive
                    ? 'shell-nav-active'
                    : 'shell-nav-inactive'
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            aria-expanded={mobileOverflowOpen}
            aria-haspopup="dialog"
            aria-label="More navigation options"
            data-testid={mobileOverflowActive ? 'shell-nav-active-mobile' : 'shell-nav-more-trigger'}
            onClick={() => setMobileOverflowOpen(true)}
            className={`shell-focus-ring flex min-w-0 flex-col items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium ${
              mobileOverflowActive
                ? 'shell-nav-active'
                : 'shell-nav-inactive'
            }`}
          >
            <MoreHorizontal size={16} />
            <span>More</span>
          </button>
        </div>
      </nav>
      <Dialog
        open={mobileOverflowOpen}
        onClose={() => setMobileOverflowOpen(false)}
        ariaLabel="More navigation options"
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm md:hidden"
      >
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-950">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--shell-text-primary)]">More</h2>
              <p className="text-xs text-[var(--shell-text-tertiary)]">Additional app routes</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileOverflowOpen(false)}
              className="shell-focus-ring rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-[var(--shell-text-secondary)] dark:border-white/15 dark:text-[var(--shell-text-secondary)]"
            >
              Close
            </button>
          </div>
          <nav aria-label="More navigation" className="space-y-2">
            {mobileOverflowNavItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? 'page' : undefined}
                  data-testid={isActive ? 'shell-nav-active-mobile-overflow' : undefined}
                  className={`shell-focus-ring flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium ${
                    isActive
                      ? 'shell-nav-active'
                      : 'shell-nav-inactive border-slate-200 dark:border-white/10'
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </Dialog>
    </div>
  )
}
