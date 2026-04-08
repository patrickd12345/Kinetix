import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import HelpCenter from '../pages/HelpCenter'
import { AuthContext, type AuthContextValue } from '../components/providers/useAuth'
import { setActivePlatformProfile } from '../lib/authState'
import { DETERMINISTIC_FALLBACK_DISCLAIMER } from '../lib/helpCenterFallback'
import { querySupportKB } from '../lib/supportRagClient'

vi.mock('../lib/supportRagClient', () => ({
  querySupportKB: vi.fn(),
  createSupportTicket: vi.fn(),
}))

import { createSupportTicket } from '../lib/supportRagClient'

function renderHelp() {
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

describe('Help Center support KB UI', () => {
  beforeEach(() => {
    setActivePlatformProfile({ id: 'u1', age: 35, weight_kg: 70 })
    vi.mocked(querySupportKB).mockReset()
    vi.mocked(createSupportTicket).mockReset()
    vi.stubEnv('VITE_SUPPORT_EMAIL', 'support@kinetix.test')
  })

  afterEach(() => {
    setActivePlatformProfile(null)
    vi.unstubAllEnvs()
  })

  it('renders support search section', async () => {
    renderHelp()
    expect(await screen.findByRole('heading', { name: 'Search support articles' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Support search question' })).toBeInTheDocument()
  })

  it('shows unavailable message and AI escalation proposal (no mailto)', async () => {
    const user = userEvent.setup()
    vi.mocked(querySupportKB).mockResolvedValue({ ok: false, reason: 'unavailable' })

    renderHelp()
    await user.click(screen.getByRole('button', { name: 'Strava connection' }))

    await waitFor(() => {
      expect(screen.getByText(/Curated support search is unavailable/)).toBeInTheDocument()
      expect(screen.getByTestId('deterministic-fallback')).toBeInTheDocument()
      expect(screen.getByText(DETERMINISTIC_FALLBACK_DISCLAIMER)).toBeInTheDocument()
    })
    expect(screen.queryByTestId('help-escalation-mailto')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('help-escalation-proposal')).toBeInTheDocument()
    })
    expect(screen.getByText(/Would you like me to escalate this to the team/i)).toBeInTheDocument()
  })

  it('shows retrieved article titles when query succeeds', async () => {
    const user = userEvent.setup()
    vi.mocked(querySupportKB).mockResolvedValue({
      ok: true,
      data: {
        collection: 'kinetix_support_kb',
        query: 'test',
        topK: 5,
        filters: { topic: null },
        results: [
          {
            chunkId: 'art:v1:0',
            distance: 0.1,
            similarity: 0.9,
            document: 'Long body text for the article.',
            metadata: { title: 'Strava OAuth', topic: 'sync' },
          },
        ],
      },
    })

    renderHelp()
    await user.click(screen.getByRole('button', { name: 'Strava connection' }))

    await waitFor(() => {
      expect(screen.getByText('Strava OAuth')).toBeInTheDocument()
      expect(screen.getByText(/Long body text/)).toBeInTheDocument()
    })
    expect(screen.queryByTestId('deterministic-fallback')).not.toBeInTheDocument()
    expect(screen.queryByTestId('help-escalation-proposal')).not.toBeInTheDocument()
  })

  it('shows deterministic fallback when retrieval returns no results', async () => {
    const user = userEvent.setup()
    vi.mocked(querySupportKB).mockResolvedValue({
      ok: true,
      data: {
        collection: 'kinetix_support_kb',
        query: 'How do I connect or sync Strava?',
        topK: 5,
        filters: { topic: null },
        results: [],
      },
    })

    renderHelp()
    await user.click(screen.getByRole('button', { name: 'Strava connection' }))

    await waitFor(() => {
      expect(screen.getByTestId('deterministic-fallback')).toBeInTheDocument()
      expect(screen.getByText(/Connections \(Strava/)).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByTestId('help-escalation-proposal')).toBeInTheDocument()
    })
  })

  it('does not create ticket before user confirms Yes', async () => {
    const user = userEvent.setup()
    vi.mocked(querySupportKB).mockResolvedValue({ ok: false, reason: 'unavailable' })

    renderHelp()
    await user.click(screen.getByRole('button', { name: 'Strava connection' }))

    await waitFor(() => {
      expect(screen.getByTestId('help-escalation-proposal')).toBeInTheDocument()
    })
    expect(createSupportTicket).not.toHaveBeenCalled()
  })

  it('hides proposal after No until a new unresolved retrieval', async () => {
    const user = userEvent.setup()
    vi.mocked(querySupportKB).mockResolvedValue({ ok: false, reason: 'unavailable' })

    renderHelp()
    await user.click(screen.getByRole('button', { name: 'Strava connection' }))

    await waitFor(() => {
      expect(screen.getByTestId('help-escalation-proposal')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('help-escalation-confirm-no'))

    await waitFor(() => {
      expect(screen.queryByTestId('help-escalation-proposal')).not.toBeInTheDocument()
    })
    expect(createSupportTicket).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Strava connection' }))

    await waitFor(() => {
      expect(screen.getByTestId('help-escalation-proposal')).toBeInTheDocument()
    })
  })

  it('shows capped message after max escalation proposals', async () => {
    const user = userEvent.setup()
    vi.mocked(querySupportKB).mockResolvedValue({ ok: false, reason: 'unavailable' })

    renderHelp()
    for (let i = 0; i < 2; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Strava connection' }))
      await waitFor(() => {
        expect(screen.getByTestId('help-escalation-proposal')).toBeInTheDocument()
      })
      await user.click(screen.getByTestId('help-escalation-confirm-no'))
      await waitFor(() => {
        expect(screen.queryByTestId('help-escalation-proposal')).not.toBeInTheDocument()
      })
    }

    await user.click(screen.getByRole('button', { name: 'Strava connection' }))
    await waitFor(() => {
      expect(screen.getByTestId('help-escalation-capped')).toBeInTheDocument()
      expect(screen.queryByTestId('help-escalation-proposal')).not.toBeInTheDocument()
    })
  })

  it('creates ticket when user confirms escalation', async () => {
    const user = userEvent.setup()
    vi.mocked(querySupportKB).mockResolvedValue({ ok: false, reason: 'unavailable' })
    vi.mocked(createSupportTicket).mockResolvedValue({
      ok: true,
      ticketId: 'ticket-uuid-1',
      receivedAt: '2026-01-01T00:00:00.000Z',
    })

    renderHelp()
    await user.click(screen.getByRole('button', { name: 'Strava connection' }))

    await waitFor(() => {
      expect(screen.getByTestId('help-escalation-proposal')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('help-escalation-confirm-yes'))

    await waitFor(() => {
      expect(createSupportTicket).toHaveBeenCalled()
      expect(screen.getByTestId('help-escalation-success')).toHaveTextContent('ticket-uuid-1')
    })
  })
})
