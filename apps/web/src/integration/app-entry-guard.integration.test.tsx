import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'
import { AuthContext, type AuthContextValue } from '../components/providers/useAuth'

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const appSource = readFileSync(resolve(srcDir, 'App.tsx'), 'utf8')
const mainSource = readFileSync(resolve(srcDir, 'main.tsx'), 'utf8')

function renderWithAuth(value: Partial<AuthContextValue>) {
  const base: AuthContextValue = {
    status: 'loading',
    session: null,
    profile: null,
    error: null,
    sendMagicLink: async () => {},
    signInWithOAuth: async () => {},
    oauthProviders: { google: false, apple: false, microsoft: false },
    signOut: async () => {},
    refresh: async () => {},
  }

  return render(
    <AuthContext.Provider value={{ ...base, ...value }}>
      <App />
    </AuthContext.Provider>
  )
}

describe('App entry guards', () => {
  it('shows profile hydration screen instead of crashing when status is authenticated but profile is missing', async () => {
    window.history.pushState({}, '', '/')

    renderWithAuth({
      status: 'authenticated',
      profile: null,
      error: null,
      session: { user: { id: 'user-1', email: 'runner@example.com' } } as AuthContextValue['session'],
      sendMagicLink: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      refresh: vi.fn(),
    })

    expect(await screen.findByText('Loading profile...')).toBeInTheDocument()
    expect(
      screen.getByText('Finalizing your platform profile. If this does not resolve, refresh the page.')
    ).toBeInTheDocument()
  })

  it('keeps the authenticated home dashboard behind the route lazy boundary', () => {
    expect(appSource).toContain("const RunDashboard = lazy(() => import('./pages/RunDashboard'))")
    expect(appSource).not.toContain("import RunDashboard from './pages/RunDashboard'")
  })

  it('keeps browser Sentry behind a dynamic startup import', () => {
    expect(mainSource).toContain("import('./lib/sentry')")
    expect(mainSource).not.toContain("from './lib/sentry'")
    expect(mainSource).not.toContain('@sentry/react')
  })
})
