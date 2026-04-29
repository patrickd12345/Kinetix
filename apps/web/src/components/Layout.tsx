import { ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { emitStructuredLog } from '@bookiji-inc/observability'
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
  ChevronDown,
} from 'lucide-react'
import { useAuth } from './providers/useAuth'
import { useSettingsStore } from '../store/settingsStore'
import { toKinetixUserProfile } from '../lib/kinetixProfile'
import { getActiveScopedDbUserId, getRunsPage } from '../lib/database'
import { syncNewRunsToRAG } from '../lib/ragClient'
import { syncStravaRuns, getValidStravaToken } from '../lib/strava'
import { scheduleStartupAttempts } from '../lib/startupOrchestrator'
import { runWithingsStartupReload } from '../lib/integrations/withings/startupSync'
import ThemeSelector from './ThemeSelector'
import AdSenseDisplayUnit from './ads/AdSenseDisplayUnit'
import AdSlot from './ads/AdSlot'
import Footer from './Footer'
import CookieBanner from './CookieBanner'
import WithingsSyncPrompt from './WithingsSyncPrompt'
import { Dialog } from './a11y/Dialog'
import { ragBannerDismissedSessionKey, ragFailStreakSessionKey } from '../lib/clientStorageScope'
import { isRagServiceConfigured } from '../lib/env/envReadiness'
import { formatOptionalIntegrationError } from '../lib/env/runtime'

const RAG_SYNC_PAGE_SIZE = 200
const RAG_SYNC_FAIL_THRESHOLD = 3
/** Deferred past first paint (KX-MVP-BETA-001). */
const STRAVA_STARTUP_RETRY_DELAYS_MS = [1500, 2000, 3000, 4000, 5500, 6500] as const
const WITHINGS_STARTUP_RETRY_DELAYS_MS = [2000, 3500, 6000] as const

function readRagFailStreak(authUserId: string): number {
  if (typeof sessionStorage === 'undefined') return 0
  return Number(sessionStorage.getItem(ragFailStreakSessionKey(authUserId))) || 0
}

function isRagBannerDismissed(authUserId: string): boolean {
  if (typeof sessionStorage === 'undefined') return false
  return sessionStorage.getItem(ragBannerDismissedSessionKey(authUserId)) === '1'
}

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { profile, session, signOut } = useAuth()
  const authUserId = session?.user?.id ?? ''
  const signedInEmail = session?.user?.email ?? ''
  const [mobileOverflowOpen, setMobileOverflowOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const [ragSyncBannerOpen, setRagSyncBannerOpen] = useState(false)
  const {
    stravaCredentials,
    stravaToken,
    targetKPS,
    setStravaSyncError,
    settingsRehydrated,
    withingsCredentials,
    withingsExpandedSyncEnabled,
    withingsSyncTimes,
    lastSuccessfulWithingsScheduledSlotKey,
    lastSuccessfulWithingsStartupSyncDate,
    setWithingsCredentials,
    setLastWithingsWeightKg,
    setLastSuccessfulWithingsSyncAt,
    setLastSuccessfulWithingsScheduledSlotKey,
    setLastSuccessfulWithingsStartupSyncDate,
    withingsStartupSyncError,
    setWithingsStartupSyncInFlight,
    setWithingsStartupSyncError,
  } = useSettingsStore()
  const accountDisplayName = profile?.full_name ?? profile?.display_name ?? ''
  const emailInitial =
    signedInEmail.trim().length > 0 ? signedInEmail.trim().slice(0, 1).toUpperCase() : '?'

  useEffect(() => {
    if (!authUserId || typeof sessionStorage === 'undefined') {
      setRagSyncBannerOpen(false)
      return
    }
    setRagSyncBannerOpen(
      readRagFailStreak(authUserId) >= RAG_SYNC_FAIL_THRESHOLD && !isRagBannerDismissed(authUserId),
    )
  }, [authUserId])

  useEffect(() => {
    if (!accountMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [accountMenuOpen])

  useEffect(() => {
    if (!isRagServiceConfigured()) return
    if (!profile || !authUserId || typeof indexedDB === 'undefined') return
    if (!getActiveScopedDbUserId()) return
    const userProfile = toKinetixUserProfile(profile)
    const run = async () => {
      try {
        const { items } = await getRunsPage(1, RAG_SYNC_PAGE_SIZE)
        if (items.length === 0) return true
        const result = await syncNewRunsToRAG(items, userProfile)
        if (result.errors === 0) {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(ragFailStreakSessionKey(authUserId))
            sessionStorage.removeItem(ragBannerDismissedSessionKey(authUserId))
          }
          setRagSyncBannerOpen(false)
          return true
        }
        if (typeof sessionStorage !== 'undefined') {
          const next = readRagFailStreak(authUserId) + 1
          sessionStorage.setItem(ragFailStreakSessionKey(authUserId), String(next))
          emitStructuredLog('warn', 'rag_startup_sync_errors', {
            indexed: result.indexed,
            errors: result.errors,
            skipped: result.skipped,
            streak: next,
          })
          if (next >= RAG_SYNC_FAIL_THRESHOLD && !isRagBannerDismissed(authUserId)) {
            setRagSyncBannerOpen(true)
          }
        }
      } catch (err) {
        if (typeof sessionStorage !== 'undefined') {
          const next = readRagFailStreak(authUserId) + 1
          sessionStorage.setItem(ragFailStreakSessionKey(authUserId), String(next))
          emitStructuredLog('error', 'rag_startup_sync_threw', {
            streak: next,
            message: err instanceof Error ? err.message : String(err),
          })
          if (next >= RAG_SYNC_FAIL_THRESHOLD && !isRagBannerDismissed(authUserId)) {
            setRagSyncBannerOpen(true)
          }
        }
      }
      return true
    }
    return scheduleStartupAttempts([0], run)
  }, [profile, authUserId])

  // Sync new runs from Strava on app startup (e.g. Garmin->Strava run).
  // Uses persisted credentials (with refresh) or legacy token. Runs at 0, 500, 1500, 2500, 4000, 5000 ms
  // so that Zustand persist rehydration (async) has time to restore stravaCredentials.
  const stravaSyncDoneRef = useRef(false)
  useEffect(() => {
    if (!profile || typeof indexedDB === 'undefined') return
    if (!getActiveScopedDbUserId()) return
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
        setStravaSyncError(formatOptionalIntegrationError(e))
      }
      return true
    }
    return scheduleStartupAttempts([...STRAVA_STARTUP_RETRY_DELAYS_MS], runSync)
  }, [profile, stravaCredentials, stravaToken, targetKPS, setStravaSyncError, settingsRehydrated])

  const withingsStartupSyncDoneRef = useRef(false)
  useEffect(() => {
    if (!profile || !settingsRehydrated || !withingsCredentials || typeof indexedDB === 'undefined') return
    if (!getActiveScopedDbUserId()) return
    withingsStartupSyncDoneRef.current = false

    const runStartupReload = async () => {
      if (withingsStartupSyncDoneRef.current) return true
      const currentState = useSettingsStore.getState()
      if (currentState.withingsStartupSyncInFlight) return true

      setWithingsStartupSyncError(null)
      setWithingsStartupSyncInFlight(true)
      try {
        const result = await runWithingsStartupReload(
          {
            withingsCredentials: currentState.withingsCredentials,
            withingsExpandedSyncEnabled: currentState.withingsExpandedSyncEnabled,
            withingsSyncTimes: currentState.withingsSyncTimes,
            lastSuccessfulWithingsScheduledSlotKey: currentState.lastSuccessfulWithingsScheduledSlotKey,
            lastSuccessfulWithingsStartupSyncDate: currentState.lastSuccessfulWithingsStartupSyncDate,
          },
          {
            setWithingsCredentials,
            setLastWithingsWeightKg,
            setLastSuccessfulWithingsSyncAt,
            setLastSuccessfulWithingsScheduledSlotKey,
            setLastSuccessfulWithingsStartupSyncDate,
          }
        )
        withingsStartupSyncDoneRef.current = true
        if (result.started) {
          emitStructuredLog('info', 'withings_startup_sync_complete', {
            expandedSyncRan: result.expandedSyncRan,
            historyEntriesSynced: result.historyEntriesSynced,
            latestKgUpdated: result.latestKg != null,
          })
        }
        return true
      } catch (error) {
        const message = formatOptionalIntegrationError(error)
        setWithingsStartupSyncError(message)
        emitStructuredLog('warn', 'withings_startup_sync_failed', { message })
        return false
      } finally {
        setWithingsStartupSyncInFlight(false)
      }
    }

    return scheduleStartupAttempts([...WITHINGS_STARTUP_RETRY_DELAYS_MS], runStartupReload)
  }, [
    profile,
    settingsRehydrated,
    withingsCredentials,
    withingsExpandedSyncEnabled,
    withingsSyncTimes,
    lastSuccessfulWithingsScheduledSlotKey,
    lastSuccessfulWithingsStartupSyncDate,
    setWithingsCredentials,
    setLastWithingsWeightKg,
    setLastSuccessfulWithingsSyncAt,
    setLastSuccessfulWithingsScheduledSlotKey,
    setLastSuccessfulWithingsStartupSyncDate,
    setWithingsStartupSyncInFlight,
    setWithingsStartupSyncError,
  ])

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
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <ThemeSelector />
              <span
                className="min-w-0 max-w-[min(42vw,14rem)] truncate text-xs font-semibold text-[var(--shell-text-primary)] sm:max-w-[min(36vw,18rem)] md:max-w-xs"
                title={signedInEmail || undefined}
                data-testid="shell-signed-in-email"
              >
                {signedInEmail || 'Signed in'}
              </span>
              <div className="relative shrink-0" ref={accountMenuRef}>
                <button
                  type="button"
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Account menu"
                  data-testid="shell-account-menu-trigger"
                  onClick={() => setAccountMenuOpen((o) => !o)}
                  className="shell-focus-ring flex items-center gap-1 rounded-full border border-slate-300/60 bg-white/90 px-1.5 py-1 text-[var(--shell-text-primary)] shadow-sm hover:bg-white dark:border-white/15 dark:bg-slate-900/90 dark:hover:bg-slate-900"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-700/15 text-xs font-bold text-cyan-950 dark:bg-cyan-400/15 dark:text-cyan-50"
                    aria-hidden
                  >
                    {emailInitial}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-70" aria-hidden />
                </button>
                {accountMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white py-2 text-sm shadow-xl dark:border-white/10 dark:bg-slate-950"
                  >
                    {accountDisplayName.trim() ? (
                      <div className="border-b border-slate-200 px-4 py-2 dark:border-white/10">
                        <div className="text-xs font-medium text-[var(--shell-text-tertiary)]">Name</div>
                        <div className="font-medium text-[var(--shell-text-primary)]">{accountDisplayName}</div>
                      </div>
                    ) : null}
                    <div className="border-b border-slate-200 px-4 py-2 dark:border-white/10">
                      <div className="text-xs font-medium text-[var(--shell-text-tertiary)]">Email</div>
                      <div className="break-all text-[var(--shell-text-primary)]">{signedInEmail || '—'}</div>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="mt-1 w-full px-4 py-2 text-left text-sm font-medium text-cyan-900 hover:bg-cyan-500/10 dark:text-cyan-100 dark:hover:bg-cyan-500/15"
                      onClick={() => {
                        setAccountMenuOpen(false)
                        void signOut()
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
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
            {ragSyncBannerOpen ? (
              <div
                role="alert"
                className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-400/80 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-50 md:flex-row md:items-center md:justify-between"
              >
                <p className="min-w-0 leading-snug">
                  Recent runs could not be fully synced to the coaching index. Answers may be less personalized until the
                  sync service is available.
                </p>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Link
                    to="/settings"
                    className="shell-focus-ring rounded-md border border-amber-700/40 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-200/60 dark:border-amber-300/40 dark:text-amber-50 dark:hover:bg-amber-500/20"
                  >
                    Open settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof sessionStorage !== 'undefined' && authUserId) {
                        sessionStorage.setItem(ragBannerDismissedSessionKey(authUserId), '1')
                      }
                      setRagSyncBannerOpen(false)
                    }}
                    className="shell-focus-ring rounded-md px-3 py-1.5 text-xs font-medium text-amber-900/90 underline-offset-2 hover:underline dark:text-amber-100/95"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}
            <WithingsSyncPrompt />
            {withingsStartupSyncError ? (
              <div
                role="status"
                className="mb-4 rounded-xl border border-amber-400/80 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-50"
              >
                Withings background reload did not complete: {withingsStartupSyncError}
              </div>
            ) : null}
            {children}
            <AdSenseDisplayUnit />
            <div className="mt-6">
              <AdSlot />
            </div>
            <Footer />
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
      <CookieBanner />
    </div>
  )
}
