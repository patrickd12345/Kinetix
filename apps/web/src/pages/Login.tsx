import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../components/providers/useAuth'
import ThemeSelector from '../components/ThemeSelector'

type Mode = 'signin' | 'signup'

export default function Login() {
  const { status, signInWithPassword, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'authenticated' || status === 'forbidden') {
    return <Navigate to="/" replace />
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      if (mode === 'signin') {
        await signInWithPassword(email.trim(), password)
      } else {
        await signUp(email.trim(), password)
        setSuccess('Account created. Check your email to confirm the link, or sign in below.')
        setMode('signin')
        setPassword('')
        setConfirmPassword('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'signin' ? 'Sign in failed' : 'Sign up failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 flex items-center justify-center px-4 dark:from-gray-950 dark:via-black dark:to-gray-950">
      <div className="absolute right-4 top-4 z-10">
        <ThemeSelector />
      </div>
      <div className="w-full max-w-md glass rounded-2xl border border-slate-200/90 p-6 space-y-4 dark:border-white/10">
        <h1 className="text-2xl font-black italic tracking-wider text-slate-900 dark:text-white">KINETIX</h1>
        <p className="text-sm text-slate-600 dark:text-gray-400">
          {mode === 'signin' ? 'Sign in or create an account to continue.' : 'Create an account to get started.'}
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
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

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 dark:border-gray-700 dark:bg-gray-900/50 dark:text-white"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 dark:border-gray-700 dark:bg-gray-900/50 dark:text-white"
                autoComplete="new-password"
                required
                minLength={6}
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {success && <p className="text-sm text-green-700 dark:text-green-400">{success}</p>}

          <button
            type="submit"
            disabled={submitting || !email.trim() || !password || (mode === 'signup' && password !== confirmPassword)}
            className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white rounded-lg px-4 py-2 font-semibold transition"
          >
            {submitting
              ? mode === 'signin'
                ? 'Signing in…'
                : 'Creating account…'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-600 dark:text-gray-500">
          {mode === 'signin' ? (
            <>
              No account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(null); setSuccess(null); setConfirmPassword(''); }}
                className="text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null); setSuccess(null); setConfirmPassword(''); }}
                className="text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
