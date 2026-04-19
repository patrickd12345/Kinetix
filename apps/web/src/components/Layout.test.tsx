import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Layout from './Layout'
import { AuthContext, type AuthContextValue } from './providers/useAuth'

vi.mock('../lib/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/database')>()
  return {
    ...actual,
    getRunsPage: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  }
})

vi.mock('../lib/ragClient', () => ({
  syncNewRunsToRAG: vi.fn().mockResolvedValue({ indexed: 0, errors: 0, skipped: 0 }),
}))

vi.mock('../lib/strava', () => ({
  syncStravaRuns: vi.fn(),
  getValidStravaToken: vi.fn().mockResolvedValue(null),
}))

vi.mock('../lib/startupOrchestrator', () => ({
  scheduleStartupAttempts: vi.fn(() => () => {}),
}))

vi.mock('../lib/integrations/withings/startupSync', () => ({
  runWithingsStartupReload: vi.fn().mockResolvedValue({
    started: false,
    expandedSyncRan: false,
    historyEntriesSynced: 0,
    latestKgUpdated: false,
    latestKg: null,
  }),
}))

describe('Layout shell identity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows signed-in email in header (mandatory visibility)', () => {
    const value: AuthContextValue = {
      status: 'authenticated',
      session: {
        user: {
          id: 'auth-user-1',
          email: 'runner@example.com',
        },
      } as AuthContextValue['session'],
      profile: {
        id: 'auth-user-1',
        email: 'runner@example.com',
        display_name: 'Display',
        full_name: 'Runner Full',
      } as AuthContextValue['profile'],
      error: null,
      sendMagicLink: vi.fn(),
      signInWithOAuth: vi.fn(),
      oauthProviders: { google: false, apple: false, microsoft: false },
      signOut: vi.fn(),
      refresh: vi.fn(),
    }

    render(
      <MemoryRouter>
        <AuthContext.Provider value={value}>
          <Layout>
            <div />
          </Layout>
        </AuthContext.Provider>
      </MemoryRouter>
    )

    expect(screen.getByTestId('shell-signed-in-email')).toHaveTextContent('runner@example.com')
    expect(screen.getByTestId('shell-account-menu-trigger')).toBeInTheDocument()
  })
})
