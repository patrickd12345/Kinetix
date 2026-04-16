import ThemeSelector from '../components/ThemeSelector'
import { useState } from 'react'
import { useAuth } from '../components/providers/useAuth'
import { createKinetixCheckoutSession } from '../lib/kinetixBilling'

export default function EntitlementRequired() {
  const { session } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onContinueToCheckout = async () => {
    if (loading) return
    setLoading(true)
    setError(null)

    const origin = window.location.origin
    const successUrl = `${origin}/billing/success`
    const cancelUrl = `${origin}/billing/cancel`

    const result = await createKinetixCheckoutSession({
      accessToken: session?.access_token,
      successUrl,
      cancelUrl,
    })

    if (result.ok) {
      window.location.assign(result.url)
      return
    }

    setError(result.message)
    setLoading(false)
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 flex items-center justify-center px-4 dark:from-gray-950 dark:via-black dark:to-gray-950">
      <div className="absolute right-4 top-4 z-10">
        <ThemeSelector />
      </div>
      <div className="w-full max-w-md glass rounded-2xl border border-slate-200/90 p-6 space-y-3 dark:border-white/10">
        <h1 className="text-2xl font-black italic tracking-wider text-slate-900 dark:text-white">KINETIX</h1>
        <h2 className="text-lg font-semibold text-cyan-800 dark:text-cyan-300">Entitlement required</h2>
        <p className="text-sm text-slate-600 dark:text-gray-300">
          The current account is signed in, but no active `kinetix` entitlement exists in platform access.
        </p>
        {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
        <div className="pt-2">
          <button
            type="button"
            onClick={onContinueToCheckout}
            disabled={loading}
            className="w-full rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Starting checkout...' : 'Continue to checkout'}
          </button>
        </div>
      </div>
    </div>
  )
}
