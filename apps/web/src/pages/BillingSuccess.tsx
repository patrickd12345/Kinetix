import { useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthContext } from '../components/providers/useAuth'
import ThemeSelector from '../components/ThemeSelector'

export default function BillingSuccess() {
  const auth = useContext(AuthContext)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onRefreshAccess = async () => {
    setError(null)

    if (!auth?.refresh) {
      window.location.reload()
      return
    }

    setRefreshing(true)
    try {
      await auth.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh access. Please reload the page.')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 flex items-center justify-center px-4 dark:from-gray-950 dark:via-black dark:to-gray-950">
      <div className="absolute right-4 top-4 z-10">
        <ThemeSelector />
      </div>
      <div className="w-full max-w-md glass rounded-2xl border border-slate-200/90 p-6 space-y-3 dark:border-white/10">
        <h1 className="text-2xl font-black italic tracking-wider text-slate-900 dark:text-white">KINETIX</h1>
        <h2 className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">Payment completed</h2>
        <p className="text-sm text-slate-600 dark:text-gray-300">
          Your checkout completed successfully. It can take a few seconds for access to activate.
        </p>
        {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={onRefreshAccess}
            disabled={refreshing}
            className="w-full rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {refreshing ? 'Refreshing...' : 'Refresh access'}
          </button>
          <Link
            to="/"
            className="w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-center text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-white/90 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            Go to app
          </Link>
        </div>
      </div>
    </div>
  )
}

