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
}))

function renderHelp() {
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

  it('shows unavailable message when querySupportKB returns unavailable', async () => {
    const user = userEvent.setup()
    vi.mocked(querySupportKB).mockResolvedValue({ ok: false, reason: 'unavailable' })

    renderHelp()
    await user.click(screen.getByRole('button', { name: 'Strava connection' }))

    await waitFor(() => {
      expect(screen.getByText(/Curated support search is unavailable/)).toBeInTheDocument()
      expect(screen.getByTestId('deterministic-fallback')).toBeInTheDocument()
      expect(screen.getByText(DETERMINISTIC_FALLBACK_DISCLAIMER)).toBeInTheDocument()
    })
    const esc = screen.getByTestId('help-escalation-mailto') as HTMLAnchorElement
    expect(esc.href).toMatch(/^mailto:support@kinetix\.test\?/)
    expect(decodeURIComponent(esc.href)).toContain('retrieval_state: service_unavailable')
    expect(screen.getByTestId('help-contact-mailto-context')).toBeInTheDocument()
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
    expect(screen.queryByTestId('help-escalation-mailto')).not.toBeInTheDocument()
    expect(screen.getByTestId('help-contact-mailto-generic')).toBeInTheDocument()
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
    const esc = screen.getByTestId('help-escalation-mailto') as HTMLAnchorElement
    expect(decodeURIComponent(esc.href)).toContain('retrieval_state: retrieval_empty')
  })

  it('shows deterministic fallback when matches are weak', async () => {
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
            chunkId: 'w:v1:0',
            distance: 2,
            similarity: 0.05,
            document: 'Low relevance text.',
            metadata: { title: 'Maybe', topic: 'general' },
          },
        ],
      },
    })

    renderHelp()
    await user.click(screen.getByRole('button', { name: 'Strava connection' }))

    await waitFor(() => {
      expect(screen.getByText(/matches below look weak/i)).toBeInTheDocument()
      expect(screen.getByTestId('deterministic-fallback')).toBeInTheDocument()
    })
    const esc = screen.getByTestId('help-escalation-mailto') as HTMLAnchorElement
    expect(decodeURIComponent(esc.href)).toContain('retrieval_state: retrieval_weak')
    expect(decodeURIComponent(esc.href)).toContain('chunk_id=w:v1:0')
  })
})
