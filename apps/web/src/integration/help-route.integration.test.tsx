import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import HelpCenter from '../pages/HelpCenter'
import { AuthContext, type AuthContextValue } from '../components/providers/useAuth'
import { setActivePlatformProfile } from '../lib/authState'

function renderHelpAtHelpPath() {
  const value: AuthContextValue = {
    status: 'authenticated',
    session: { user: { id: 'u1' } } as AuthContextValue['session'],
    profile: { id: 'u1', age: 35, weight_kg: 70 },
    error: null,
    sendMagicLink: vi.fn(),
    signInWithOAuth: vi.fn(),
    oauthProviders: { google: false, apple: false, microsoft: false },
    signOut: vi.fn(),
    refresh: vi.fn(),
  }

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={['/help']}
      >
        <Routes>
          <Route path="/help" element={<HelpCenter />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('Help route', () => {
  beforeEach(() => {
    setActivePlatformProfile({ id: 'u1', age: 35, weight_kg: 70 })
  })

  afterEach(() => {
    setActivePlatformProfile(null)
  })

  it('renders the Help Center page at path /help', async () => {
    renderHelpAtHelpPath()
    expect(await screen.findByRole('heading', { name: 'Help Center' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI Help' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Search support articles' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Team escalation' })).toBeInTheDocument()
  })
})
