import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Menu from '../pages/Menu'
import { AuthContext, type AuthContextValue } from '../components/providers/useAuth'
import { setActivePlatformProfile } from '../lib/authState'

function renderMenuAtMenuPath() {
  const value: AuthContextValue = {
    status: 'authenticated',
    session: { user: { id: 'u1' } } as AuthContextValue['session'],
    profile: { id: 'u1', age: 35, weight_kg: 70 },
    error: null,
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    refresh: vi.fn(),
  }

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/menu']}>
        <Routes>
          <Route path="/menu" element={<Menu />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('Menu route', () => {
  beforeEach(() => {
    setActivePlatformProfile({ id: 'u1', age: 35, weight_kg: 70 })
  })

  afterEach(() => {
    setActivePlatformProfile(null)
  })

  it('renders the Menu page (Charts) at path /menu', async () => {
    renderMenuAtMenuPath()
    expect(await screen.findByRole('heading', { name: 'Charts' })).toBeInTheDocument()
  })
})
