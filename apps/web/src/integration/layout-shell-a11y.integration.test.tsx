import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Layout from '../components/Layout'
import { AuthContext, type AuthContextValue } from '../components/providers/useAuth'
import { setActivePlatformProfile } from '../lib/authState'

function renderLayoutAt(path: string) {
  const value: AuthContextValue = {
    status: 'authenticated',
    session: { user: { id: 'u1' }, access_token: 't' } as AuthContextValue['session'],
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
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}>
        <Routes>
          <Route
            path="*"
            element={
              <Layout>
                <div>Shell child</div>
              </Layout>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('Layout shell accessibility', () => {
  beforeEach(() => {
    setActivePlatformProfile({ id: 'u1', age: 35, weight_kg: 70 })
  })

  afterEach(() => {
    setActivePlatformProfile(null)
  })

  it('exposes a single primary navigation region (sidebar), not duplicated in the header', () => {
    renderLayoutAt('/')

    const primary = screen.getAllByRole('navigation', { name: 'Primary navigation' })
    expect(primary).toHaveLength(1)

    const header = document.querySelector('header')
    expect(header).toBeTruthy()
    const headerNav = header?.querySelector('nav')
    expect(headerNav).toBeNull()
  })

  it('marks the active route in the primary nav on the dashboard', () => {
    renderLayoutAt('/')

    expect(document.querySelector('[data-testid="shell-nav-active"]')).toBeTruthy()
  })

  it('uses trimmed mobile navigation with a More trigger for overflow routes', async () => {
    const user = userEvent.setup()
    renderLayoutAt('/settings')

    const mobileNav = screen.getByRole('navigation', { name: 'Mobile navigation' })
    expect(within(mobileNav).getByRole('link', { name: 'Run' })).toBeInTheDocument()
    expect(within(mobileNav).getByRole('link', { name: 'History' })).toBeInTheDocument()
    expect(within(mobileNav).getByRole('link', { name: 'Coaching' })).toBeInTheDocument()
    expect(within(mobileNav).getByRole('link', { name: 'Chat' })).toBeInTheDocument()
    expect(within(mobileNav).getByRole('link', { name: 'Help' })).toBeInTheDocument()
    expect(within(mobileNav).getByRole('button', { name: 'More navigation options' })).toBeInTheDocument()
    expect(within(mobileNav).queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
    expect(document.querySelector('[data-testid="shell-nav-active-mobile"]')).toBeTruthy()

    await user.click(within(mobileNav).getByRole('button', { name: 'More navigation options' }))

    const moreNav = screen.getByRole('navigation', { name: 'More navigation' })
    expect(within(moreNav).getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    expect(document.querySelector('[data-testid="shell-nav-active-mobile-overflow"]')).toBeTruthy()
  })
})
