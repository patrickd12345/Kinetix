import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SupportQueue from '../pages/SupportQueue'
import { AuthContext, type AuthContextValue } from '../components/providers/useAuth'

vi.mock('../lib/supportQueueClient', () => ({
  listSupportQueueTickets: vi.fn(),
  getSupportQueueTicket: vi.fn(),
  updateSupportQueueTicket: vi.fn(),
  retrySupportQueueNotifications: vi.fn(),
  moveTicketToKbApprovalBin: vi.fn(),
  listKbApprovalDrafts: vi.fn(),
  getKbApprovalDraft: vi.fn(),
  updateKbApprovalDraft: vi.fn(),
  approveAndIngestKbApprovalDraft: vi.fn(),
}))

import {
  getKbApprovalDraft,
  getSupportQueueTicket,
  listKbApprovalDrafts,
  listSupportQueueTickets,
} from '../lib/supportQueueClient'

function renderQueue(initialEntry = '/support-queue?ticketId=kinetix-20260408-def456&draftId=draft-2') {
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
      <MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/support-queue" element={<SupportQueue />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('Support queue page', () => {
  beforeEach(() => {
    vi.mocked(listSupportQueueTickets).mockReset()
    vi.mocked(getSupportQueueTicket).mockReset()
    vi.mocked(listKbApprovalDrafts).mockReset()
    vi.mocked(getKbApprovalDraft).mockReset()

    vi.mocked(listSupportQueueTickets).mockResolvedValue([
      {
        ticket_id: 'kinetix-20260408-abc123',
        status: 'open',
        severity: 'unknown',
        issue_summary: 'First ticket',
        internal_notes: '',
        notification_slack_status: 'pending',
        notification_email_status: 'pending',
        notification_error_summary: '',
        notification_last_attempt_at: null,
        kb_approval_status: 'none',
        created_at: '2026-04-08T10:00:00.000Z',
        updated_at: '2026-04-08T10:00:00.000Z',
        metadata: { inferred_topic: 'general', retrieval_state: 'unknown', route: '/help' },
      },
      {
        ticket_id: 'kinetix-20260408-def456',
        status: 'resolved',
        severity: 'medium',
        issue_summary: 'Linked ticket',
        internal_notes: 'Linked operator note',
        notification_slack_status: 'failed',
        notification_email_status: 'sent',
        notification_error_summary: 'slack:500',
        notification_last_attempt_at: '2026-04-08T10:05:00.000Z',
        kb_approval_status: 'drafted',
        created_at: '2026-04-08T10:01:00.000Z',
        updated_at: '2026-04-08T10:06:00.000Z',
        metadata: { inferred_topic: 'sync', retrieval_state: 'service_unavailable', route: '/help' },
      },
    ])

    vi.mocked(listKbApprovalDrafts).mockResolvedValue([
      {
        id: 'draft-1',
        source_ticket_id: 'kinetix-20260408-abc123',
        artifact_id: 'ticket-resolution-kinetix-20260408-abc123',
        title: 'Draft one',
        body_markdown: '# Draft one',
        review_status: 'draft',
        topic: 'general',
        intent: 'troubleshoot',
        updated_at: '2026-04-08T10:00:00.000Z',
      },
      {
        id: 'draft-2',
        source_ticket_id: 'kinetix-20260408-def456',
        artifact_id: 'ticket-resolution-kinetix-20260408-def456',
        title: 'Draft two',
        body_markdown: '# Draft two',
        review_status: 'approved',
        topic: 'sync',
        intent: 'howto',
        updated_at: '2026-04-08T10:06:00.000Z',
      },
    ])

    vi.mocked(getSupportQueueTicket).mockImplementation(async (_session, ticketId) => {
      if (ticketId === 'kinetix-20260408-def456') {
        return {
          ticket_id: 'kinetix-20260408-def456',
          status: 'resolved',
          severity: 'medium',
          issue_summary: 'Linked ticket',
          internal_notes: 'Linked operator note',
          notification_slack_status: 'failed',
          notification_email_status: 'sent',
          notification_error_summary: 'slack:500',
          notification_last_attempt_at: '2026-04-08T10:05:00.000Z',
          kb_approval_status: 'drafted',
          created_at: '2026-04-08T10:01:00.000Z',
          updated_at: '2026-04-08T10:06:00.000Z',
          metadata: { inferred_topic: 'sync', retrieval_state: 'service_unavailable', route: '/help' },
        }
      }

      return {
        ticket_id: 'kinetix-20260408-abc123',
        status: 'open',
        severity: 'unknown',
        issue_summary: 'First ticket',
        internal_notes: '',
        notification_slack_status: 'pending',
        notification_email_status: 'pending',
        notification_error_summary: '',
        notification_last_attempt_at: null,
        kb_approval_status: 'none',
        created_at: '2026-04-08T10:00:00.000Z',
        updated_at: '2026-04-08T10:00:00.000Z',
        metadata: { inferred_topic: 'general', retrieval_state: 'unknown', route: '/help' },
      }
    })

    vi.mocked(getKbApprovalDraft).mockImplementation(async (_session, draftId) => {
      if (draftId === 'draft-2') {
        return {
          id: 'draft-2',
          source_ticket_id: 'kinetix-20260408-def456',
          artifact_id: 'ticket-resolution-kinetix-20260408-def456',
          title: 'Draft two',
          body_markdown: '# Draft two',
          review_status: 'approved',
          topic: 'sync',
          intent: 'howto',
          updated_at: '2026-04-08T10:06:00.000Z',
        }
      }
      return {
        id: 'draft-1',
        source_ticket_id: 'kinetix-20260408-abc123',
        artifact_id: 'ticket-resolution-kinetix-20260408-abc123',
        title: 'Draft one',
        body_markdown: '# Draft one',
        review_status: 'draft',
        topic: 'general',
        intent: 'troubleshoot',
        updated_at: '2026-04-08T10:00:00.000Z',
      }
    })
  })

  it('selects the ticket and draft from the support queue URL', async () => {
    renderQueue()

    await waitFor(() => {
      expect(screen.getByText('kinetix-20260408-def456')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Linked operator note')).toBeInTheDocument()
      expect(screen.getByDisplayValue('resolved')).toBeInTheDocument()
      expect(screen.getByDisplayValue('sync')).toBeInTheDocument()
      expect(screen.getByDisplayValue('howto')).toBeInTheDocument()
      expect(screen.getByDisplayValue('approved')).toBeInTheDocument()
    })
  })

  it('resolves deep links even when the requested ticket is outside the initial list window', async () => {
    vi.mocked(listSupportQueueTickets).mockResolvedValue([
      {
        ticket_id: 'kinetix-20260408-abc123',
        status: 'open',
        severity: 'unknown',
        issue_summary: 'First ticket',
        internal_notes: '',
        notification_slack_status: 'pending',
        notification_email_status: 'pending',
        notification_error_summary: '',
        notification_last_attempt_at: null,
        kb_approval_status: 'none',
        created_at: '2026-04-08T10:00:00.000Z',
        updated_at: '2026-04-08T10:00:00.000Z',
        metadata: { inferred_topic: 'general', retrieval_state: 'unknown', route: '/help' },
      },
    ])

    renderQueue('/support-queue?ticketId=kinetix-20260408-def456')

    await waitFor(() => {
      expect(screen.getByText('kinetix-20260408-def456')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Linked operator note')).toBeInTheDocument()
    })
  })
})
