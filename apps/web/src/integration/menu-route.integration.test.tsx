import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'
import { AuthContext, type AuthContextValue } from '../components/providers/useAuth'

function renderWithAuthenticatedUser() {
  const value: AuthContextValue = {
    status: 'authenticated',
    session: { user: { id: 'user-1', email: 'runner@example.com' } } as AuthContextValue['session'],
    profile: { id: 'user-1', display_name: 'Runner' } as AuthContextValue['profile'],
    error: null,
    signInWithPassword: async () => {},
    signUp: async () => {},
    signOut: async () => {},
    refresh: async () => {},
  }

  return render(
    <AuthContext.Provider value={value}>
      <App />
    </AuthContext.Provider>
  )
}

describe('Menu route', () => {
  it('renders the charts menu page', async () => {
    window.history.pushState({}, '', '/menu')

    renderWithAuthenticatedUser()

    expect(await screen.findByRole('heading', { name: 'Menu' })).toBeInTheDocument()
    expect(
      screen.getByText('Informative performance charts powered by your run history.')
    ).toBeInTheDocument()
  })
})
