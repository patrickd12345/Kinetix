import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import OperatorDashboard from '../pages/OperatorDashboard'
import { AuthContext, type AuthContextValue } from '../components/providers/useAuth'

vi.mock('../lib/supportQueueClient', () => ({
  listSupportQueueTickets: vi.fn(),
}))

import { listSupportQueueTickets } from '../lib/supportQueueClient'

function renderDashboard() {
  const value: AuthContextValue = {
    status: 'authenticated',
    session: { access_token: 'token-1', user: { id: 'operator-1' } } as AuthContextValue['session'],
    profile: { id: 'operator-1', age: 35, weight_kg: 70 },
    error: null,
    sendMagicLink: vi.fn(),
    signInWithOAuth: vi.fn(),
    oauthProviders: { google: false, apple: false, microsoft: false },
    signOut: vi.fn(),
    refresh: vi.fn(),
  }

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/operator']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/operator" element={<OperatorDashboard />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('Operator dashboard', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.mocked(listSupportQueueTickets).mockReset()
    vi.mocked(listSupportQueueTickets).mockResolvedValue({
      tickets: [
        {
          ticket_id: 'ticket-critical',
          status: 'in_progress',
          severity: 'high',
          issue_summary: 'Critical overdue ticket',
          internal_notes: '',
          notification_slack_status: 'pending',
          notification_email_status: 'sent',
          notification_error_summary: '',
          notification_last_attempt_at: null,
          kb_approval_status: 'none',
          created_at: '2026-04-07T08:00:00.000Z',
          updated_at: '2026-04-08T11:00:00.000Z',
          assigned_to: 'operator-1',
          assigned_at: '2026-04-07T09:00:00.000Z',
          first_response_due_at: '2026-04-07T12:00:00.000Z',
          resolution_due_at: '2026-04-07T20:00:00.000Z',
          last_operator_action_at: '2026-04-07T10:00:00.000Z',
          metadata: { inferred_topic: 'sync', retrieval_state: 'unknown', route: '/help' },
          derived: {
            labels: ['assigned', 'overdue_resolution'],
            nowIso: '2026-04-08T12:00:00.000Z',
            escalation_level: 2,
          },
        },
        {
          ticket_id: 'ticket-unassigned',
          status: 'open',
          severity: 'medium',
          issue_summary: 'Unassigned ticket',
          internal_notes: '',
          notification_slack_status: 'pending',
          notification_email_status: 'pending',
          notification_error_summary: '',
          notification_last_attempt_at: null,
          kb_approval_status: 'none',
          created_at: '2026-04-06T09:00:00.000Z',
          updated_at: '2026-04-08T10:00:00.000Z',
          assigned_to: null,
          assigned_at: null,
          first_response_due_at: '2026-04-08T14:00:00.000Z',
          resolution_due_at: '2026-04-11T10:00:00.000Z',
          last_operator_action_at: null,
          metadata: { inferred_topic: 'billing', retrieval_state: 'unknown', route: '/help' },
          derived: {
            labels: ['unassigned'],
            nowIso: '2026-04-08T12:00:00.000Z',
            escalation_level: 0,
          },
        },
        {
          ticket_id: 'ticket-retry',
          status: 'resolved',
          severity: 'low',
          issue_summary: 'Retry needed ticket',
          internal_notes: '',
          notification_slack_status: 'failed',
          notification_email_status: 'sent',
          notification_error_summary: 'slack:500',
          notification_last_attempt_at: '2026-04-08T09:05:00.000Z',
          kb_approval_status: 'drafted',
          created_at: '2026-04-05T08:00:00.000Z',
          updated_at: '2026-04-08T09:10:00.000Z',
          assigned_to: 'operator-2',
          assigned_at: '2026-04-08T08:30:00.000Z',
          first_response_due_at: '2026-04-08T12:00:00.000Z',
          resolution_due_at: '2026-04-11T08:00:00.000Z',
          last_operator_action_at: '2026-04-08T08:20:00.000Z',
          metadata: { inferred_topic: 'general', retrieval_state: 'unknown', route: '/help' },
          derived: {
            labels: ['assigned', 'awaiting_retry', 'resolved_not_kb'],
            nowIso: '2026-04-08T12:00:00.000Z',
            escalation_level: 1,
          },
        },
      ],
      summary: {
        unassigned: 1,
        overdue: 1,
        awaitingRetry: 1,
        readyForKb: 0,
        assignedToMe: 1,
        staleResolvedNotKb: 0,
        recentlyUpdated: 3,
        escalated: 2,
        escalatedLevel2: 1,
      },
      slaMetrics: {
        avg_first_response_ms: 5400000,
        avg_resolution_ms: 28800000,
        overdue_count: 1,
        resolved_last_7_days: 1,
        created_last_7_days: 3,
      },
    })
  })

  it('renders dashboard cards, SLA visibility, escalation ordering, and quick links', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('What needs attention now?')).toBeInTheDocument()
      expect(screen.getByText('Open tickets')).toBeInTheDocument()
      expect(screen.getByText('Urgent tickets')).toBeInTheDocument()
      expect(screen.getByText('Escalated tickets')).toBeInTheDocument()
      expect(screen.getByText('SLA health')).toBeInTheDocument()
      expect(screen.getByText('SLA warnings')).toBeInTheDocument()
      expect(screen.getByText('SLA breaches')).toBeInTheDocument()
      expect(screen.getByText('Go to queue')).toBeInTheDocument()
      expect(screen.getByText('Open urgent queue')).toBeInTheDocument()
      expect(screen.getByText('Open assigned to me')).toBeInTheDocument()
      expect(screen.getByText('Open escalated queue')).toBeInTheDocument()
    })

    const escalationLinks = screen.getAllByRole('link').filter((element) => element.getAttribute('href')?.includes('/support-queue?ticketId='))
    expect(escalationLinks[0]).toHaveAttribute('href', '/support-queue?ticketId=ticket-critical')
    expect(screen.getAllByText('Critical overdue ticket')[0]).toBeInTheDocument()
    expect(screen.getAllByText('SLA Breach').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Open urgent queue' })).toHaveAttribute('href', '/support-queue?urgent=1')
    expect(screen.getByRole('link', { name: 'Open assigned to me' })).toHaveAttribute('href', '/support-queue?assigned=me')
    expect(screen.getByRole('link', { name: 'Open escalated queue' })).toHaveAttribute('href', '/support-queue?escalated=1')
  })

  it('degrades cleanly when the operator dashboard flag is disabled', async () => {
    vi.stubEnv('VITE_ENABLE_OPERATOR_DASHBOARD', 'false')

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('This dashboard is disabled by feature flag. Use the support queue directly.')).toBeInTheDocument()
    })
  })
})
