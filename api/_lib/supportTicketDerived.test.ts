import { describe, expect, it } from 'vitest'
import { computeQueueSummary, deriveSupportTicketLabels, enrichTicketWithDerived } from './supportTicketDerived.js'

describe('deriveSupportTicketLabels', () => {
  const now = new Date('2026-04-08T12:00:00.000Z')

  it('flags overdue first response for open tickets past due without operator action', () => {
    const labels = deriveSupportTicketLabels(
      {
        status: 'open',
        assigned_to: null,
        kb_approval_status: 'none',
        notification_slack_status: 'pending',
        notification_email_status: 'pending',
        first_response_due_at: '2026-04-08T11:00:00.000Z',
        resolution_due_at: '2026-04-11T10:00:00.000Z',
        last_operator_action_at: null,
      },
      now,
    )
    expect(labels).toContain('overdue_first_response')
    expect(labels).toContain('unassigned')
  })

  it('does not flag overdue first response after triage', () => {
    const labels = deriveSupportTicketLabels(
      {
        status: 'triaged',
        assigned_to: 'op-1',
        kb_approval_status: 'none',
        notification_slack_status: 'pending',
        notification_email_status: 'pending',
        first_response_due_at: '2026-04-08T11:00:00.000Z',
        resolution_due_at: '2026-04-11T10:00:00.000Z',
        last_operator_action_at: null,
      },
      now,
    )
    expect(labels).not.toContain('overdue_first_response')
  })

  it('flags awaiting retry when a channel failed', () => {
    const labels = deriveSupportTicketLabels(
      {
        status: 'open',
        assigned_to: null,
        kb_approval_status: 'none',
        notification_slack_status: 'failed',
        notification_email_status: 'sent',
        first_response_due_at: '2026-04-09T10:00:00.000Z',
        resolution_due_at: '2026-04-11T10:00:00.000Z',
        last_operator_action_at: null,
      },
      now,
    )
    expect(labels).toContain('awaiting_retry')
  })

  it('flags ready_for_kb for resolved tickets not yet ingested', () => {
    const labels = deriveSupportTicketLabels(
      {
        status: 'resolved',
        assigned_to: null,
        kb_approval_status: 'none',
        notification_slack_status: 'sent',
        notification_email_status: 'sent',
        first_response_due_at: '2026-04-08T11:00:00.000Z',
        resolution_due_at: '2026-04-08T11:30:00.000Z',
        last_operator_action_at: '2026-04-08T11:20:00.000Z',
      },
      now,
    )
    expect(labels).toContain('ready_for_kb')
  })
})

describe('computeQueueSummary', () => {
  it('aggregates triage counts', () => {
    const tickets = [
      enrichTicketWithDerived(
        {
          ticket_id: 'a',
          status: 'open',
          assigned_to: null,
          kb_approval_status: 'none',
          notification_slack_status: 'failed',
          notification_email_status: 'sent',
          first_response_due_at: '2026-04-08T11:00:00.000Z',
          resolution_due_at: '2026-04-11T10:00:00.000Z',
          last_operator_action_at: null,
          updated_at: '2026-04-08T10:00:00.000Z',
        },
        new Date('2026-04-08T12:00:00.000Z'),
      ),
      enrichTicketWithDerived(
        {
          ticket_id: 'b',
          status: 'resolved',
          assigned_to: 'op-1',
          kb_approval_status: 'none',
          notification_slack_status: 'sent',
          notification_email_status: 'sent',
          first_response_due_at: '2026-04-08T11:00:00.000Z',
          resolution_due_at: '2026-04-08T12:00:00.000Z',
          last_operator_action_at: '2026-04-08T11:30:00.000Z',
          updated_at: '2026-04-08T11:30:00.000Z',
        },
        new Date('2026-04-08T12:00:00.000Z'),
      ),
    ]

    const summary = computeQueueSummary(tickets, { operatorUserId: 'op-1' })
    expect(summary.awaitingRetry).toBe(1)
    expect(summary.readyForKb).toBe(1)
    expect(summary.assignedToMe).toBe(1)
  })
})
