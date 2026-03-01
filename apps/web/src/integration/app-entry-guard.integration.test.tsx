import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'
import { AuthContext, type AuthContextValue } from '../components/providers/useAuth'

function renderWithAuth(value: Partial<AuthContextValue>) {
  const base: AuthContextValue = {
    status: 'loading',
    session: null,
    profile: null,
    error: null,
    signInWithPassword: async () => {},
    signUp: async () => {},
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
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refresh: vi.fn(),
    })

    expect(await screen.findByText('Loading profile...')).toBeInTheDocument()
    expect(
      screen.getByText('Finalizing your platform profile. If this does not resolve, refresh the page.')
    ).toBeInTheDocument()
  })
})
