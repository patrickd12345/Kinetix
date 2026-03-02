import { ReactNode, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Activity, History, MessageCircle, Settings } from 'lucide-react'
import { useAuth } from './providers/useAuth'
import { useSettingsStore } from '../store/settingsStore'
import { getProfileLabel, toKinetixUserProfile } from '../lib/kinetixProfile'
import { getRunsPage } from '../lib/database'
import { syncNewRunsToRAG } from '../lib/ragClient'
import { syncStravaRuns, getValidStravaToken } from '../lib/strava'

const RAG_SYNC_PAGE_SIZE = 200

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { profile, session, signOut } = useAuth()
  const { stravaCredentials, stravaToken, targetKPS, setStravaSyncError, settingsRehydrated } = useSettingsStore()
  const profileLabel = profile ? getProfileLabel(profile, session?.user.email ?? null) : session?.user.email ?? 'User'

  useEffect(() => {
    if (!profile || typeof indexedDB === 'undefined') return
    const userProfile = toKinetixUserProfile(profile)
    const run = () => {
      getRunsPage(1, RAG_SYNC_PAGE_SIZE)
        .then(({ items }) => {
          if (items.length === 0) return
          syncNewRunsToRAG(items, userProfile).catch(() => {})
        })
        .catch(() => {})
    }
    const id = window.setTimeout(run, 0)
    return () => clearTimeout(id)
  }, [profile])

  // Sync new runs from Strava on app startup (e.g. Garmin->Strava run).
  // Uses persisted credentials (with refresh) or legacy token. Runs at 0, 500, 1500, 2500, 4000, 5000 ms
  // so that Zustand persist rehydration (async) has time to restore stravaCredentials.
  const stravaSyncDoneRef = useRef(false)
  useEffect(() => {
    if (!profile || typeof indexedDB === 'undefined') return
    stravaSyncDoneRef.current = false
    const userProfile = toKinetixUserProfile(profile)

    const runSync = async () => {
      if (stravaSyncDoneRef.current) return
      const token = await getValidStravaToken()
      if (!token?.trim() || stravaSyncDoneRef.current) {
        if (useSettingsStore.getState().stravaCredentials ?? useSettingsStore.getState().stravaToken?.trim()) {
          console.log('[Strava] Startup sync skipped: no valid token yet (refresh may have failed or rehydration pending)')
        }
        return
      }
      stravaSyncDoneRef.current = true
      console.log('[Strava] Startup sync running...')
      syncStravaRuns(token, userProfile, targetKPS)
        .then((r) => {
          if (r.added.length > 0) {
            console.log('[Strava] Imported', r.added.length, 'run(s) on startup')
            setStravaSyncError(null)
          }
          if (r.error) setStravaSyncError(r.error)
        })
        .catch((e) => setStravaSyncError(e instanceof Error ? e.message : 'Strava sync failed'))
    }
    runSync()
    const t1 = window.setTimeout(runSync, 500)
    const t2 = window.setTimeout(runSync, 1500)
    const t3 = window.setTimeout(runSync, 2500)
    const t4 = window.setTimeout(runSync, 4000)
    const t5 = window.setTimeout(runSync, 5000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      clearTimeout(t5)
    }
  }, [profile, stravaCredentials, stravaToken, targetKPS, setStravaSyncError, settingsRehydrated])

  const navItems = [
    { path: '/', icon: Activity, label: 'Run' },
    { path: '/history', icon: History, label: 'History' },
    { path: '/chat', icon: MessageCircle, label: 'Chat' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 glass border-r border-white/10 backdrop-blur-xl z-40">
        <div className="w-full p-6">
          <div className="mb-8">
            <h1 className="text-xl font-black italic tracking-wider text-white">KINETIX</h1>
            <div className="mt-3 text-xs text-gray-400 truncate">{profileLabel}</div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-2 text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
            >
              Sign out
            </button>
          </div>
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`lg:pl-64 transition-all`}>
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          {children}
        </div>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/10 backdrop-blur-xl z-40">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex justify-around items-center h-16">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all ${
                    isActive
                      ? 'text-cyan-400'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}
