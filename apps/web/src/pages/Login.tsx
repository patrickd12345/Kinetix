import { FormEvent, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../components/providers/useAuth'
import ThemeSelector from '../components/ThemeSelector'
import Footer from '../components/Footer'

export default function Login() {
  const { status, sendMagicLink, signInWithOAuth, oauthProviders } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [oauthSubmitting, setOauthSubmitting] = useState(false)
  /** Synchronous guard: React state updates are async, so rapid double-submit can fire two OTP requests before `submitting` disables the button. */
  const magicSubmitLock = useRef(false)
  const oauthSubmitLock = useRef(false)

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const raw = params.get('next')?.trim()
    if (!raw) return '/'
    if (!raw.startsWith('/')) return '/'
    return raw
  }, [location.search])

  if (status === 'authenticated' || status === 'forbidden') {
    return <Navigate to={nextPath} replace />
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting || magicSubmitLock.current) return
    magicSubmitLock.current = true
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await sendMagicLink(email.trim(), nextPath)
      setSuccess('Magic link sent. Check email to continue.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link')
    } finally {
      magicSubmitLock.current = false
      setSubmitting(false)
    }
  }

  const onOAuth = async (provider: 'google' | 'apple' | 'microsoft') => {
    if (oauthSubmitting || oauthSubmitLock.current) return
    oauthSubmitLock.current = true
    setOauthSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await signInWithOAuth(provider, nextPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to continue with ${provider}`)
    } finally {
      oauthSubmitLock.current = false
      setOauthSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 flex items-center justify-center px-4 dark:from-gray-950 dark:via-black dark:to-gray-950">
      <a
        href="#main-content"
        className="absolute left-4 top-3 z-[60] -translate-y-[140%] rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-950"
      >
        Skip to main content
      </a>
      <div className="absolute right-4 top-4 z-10">
        <ThemeSelector />
      </div>
      <main
        id="main-content"
        tabIndex={-1}
        className="w-full max-w-md glass rounded-2xl border border-slate-200/90 p-6 space-y-4 dark:border-white/10"
      >
        <h1 className="text-2xl font-black italic tracking-wider text-slate-900 dark:text-white">KINETIX</h1>
        <p className="text-sm text-slate-600 dark:text-gray-400">Continue with email</p>

        <form onSubmit={onSubmit} className="space-y-4" aria-busy={submitting || oauthSubmitting}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 dark:border-gray-700 dark:bg-gray-900/50 dark:text-white"
              autoComplete="email"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-green-700 dark:text-green-400" role="status" aria-live="polite">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || oauthSubmitting || !email.trim()}
            className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white rounded-lg px-4 py-3 text-base font-semibold transition"
          >
            {submitting ? 'Sending magic link…' : 'Send magic link'}
          </button>
        </form>

        {(oauthProviders.google || oauthProviders.apple || oauthProviders.microsoft) && (
          <div className="space-y-3">
            <p className="text-center text-sm text-slate-600 dark:text-gray-500">or</p>
            {oauthProviders.google && (
              <button
                type="button"
                onClick={() => void onOAuth('google')}
                disabled={submitting || oauthSubmitting}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900/50 dark:text-white dark:hover:bg-gray-900"
              >
                Continue with Google
              </button>
            )}
            {oauthProviders.apple && (
              <button
                type="button"
                onClick={() => void onOAuth('apple')}
                disabled={submitting || oauthSubmitting}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900/50 dark:text-white dark:hover:bg-gray-900"
              >
                Continue with Apple
              </button>
            )}
            {oauthProviders.microsoft && (
              <button
                type="button"
                onClick={() => void onOAuth('microsoft')}
                disabled={submitting || oauthSubmitting}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900/50 dark:text-white dark:hover:bg-gray-900"
              >
                Continue with Outlook
              </button>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
