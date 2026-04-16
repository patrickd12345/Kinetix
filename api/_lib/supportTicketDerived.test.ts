import { describe, expect, it, vi } from 'vitest'
import { computeQueueSummary, deriveSupportTicketLabels, enrichTicketWithDerived, getSlaMetrics } from './supportTicketDerived.js'

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

describe('escalation levels', () => {
  it('keeps level 0 for tickets that are not overdue', () => {
    const ticket = enrichTicketWithDerived(
      {
        ticket_id: 'no-escalation',
        status: 'open',
        assigned_to: null,
        kb_approval_status: 'none',
        notification_slack_status: 'pending',
        notification_email_status: 'pending',
        created_at: '2026-04-08T10:00:00.000Z',
        updated_at: '2026-04-08T10:30:00.000Z',
        first_response_due_at: '2026-04-08T11:30:00.000Z',
        resolution_due_at: '2026-04-11T10:00:00.000Z',
        last_operator_action_at: null,
      },
      new Date('2026-04-08T12:00:00.000Z'),
    )

    expect(ticket.derived.escalation_level).toBe(0)
  })

  it('sets level 1 when a ticket is overdue by more than 4 hours', () => {
    const ticket = enrichTicketWithDerived(
      {
        ticket_id: 'level-1',
        status: 'open',
        assigned_to: null,
        kb_approval_status: 'none',
        notification_slack_status: 'pending',
        notification_email_status: 'pending',
        created_at: '2026-04-08T00:00:00.000Z',
        updated_at: '2026-04-08T05:30:00.000Z',
        first_response_due_at: '2026-04-08T05:00:00.000Z',
        resolution_due_at: '2026-04-11T10:00:00.000Z',
        last_operator_action_at: null,
      },
      new Date('2026-04-08T09:30:01.000Z'),
    )

    expect(ticket.derived.escalation_level).toBe(1)
  })

  it('sets level 2 when a ticket is overdue by more than 24 hours', () => {
    const ticket = enrichTicketWithDerived(
      {
        ticket_id: 'level-2',
        status: 'in_progress',
        assigned_to: 'op-2',
        kb_approval_status: 'none',
        notification_slack_status: 'pending',
        notification_email_status: 'pending',
        created_at: '2026-04-01T10:00:00.000Z',
        updated_at: '2026-04-08T11:30:00.000Z',
        first_response_due_at: '2026-04-01T14:00:00.000Z',
        resolution_due_at: '2026-04-06T10:00:00.000Z',
        last_operator_action_at: '2026-04-01T12:00:00.000Z',
      },
      new Date('2026-04-08T12:00:00.000Z'),
    )

    expect(ticket.derived.escalation_level).toBe(2)
  })
})

describe('computeQueueSummary', () => {
  it('aggregates triage counts including escalations', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-08T12:00:00.000Z'))

    const tickets = [
      enrichTicketWithDerived(
        {
          ticket_id: 'a',
          status: 'open',
          assigned_to: null,
          kb_approval_status: 'none',
          notification_slack_status: 'failed',
          notification_email_status: 'sent',
          created_at: '2026-04-08T00:00:00.000Z',
          first_response_due_at: '2026-04-08T05:00:00.000Z',
          resolution_due_at: '2026-04-11T10:00:00.000Z',
          last_operator_action_at: null,
          updated_at: '2026-04-08T10:00:00.000Z',
        },
        new Date('2026-04-08T12:00:00.000Z'),
      ),
      enrichTicketWithDerived(
        {
          ticket_id: 'b',
          status: 'in_progress',
          assigned_to: 'op-1',
          kb_approval_status: 'none',
          notification_slack_status: 'sent',
          notification_email_status: 'sent',
          created_at: '2026-04-01T10:00:00.000Z',
          first_response_due_at: '2026-04-01T14:00:00.000Z',
          resolution_due_at: '2026-04-06T10:00:00.000Z',
          last_operator_action_at: '2026-04-01T12:00:00.000Z',
          updated_at: '2026-04-07T11:30:00.000Z',
        },
        new Date('2026-04-08T12:00:00.000Z'),
      ),
      enrichTicketWithDerived(
        {
          ticket_id: 'c',
          status: 'resolved',
          assigned_to: 'op-1',
          kb_approval_status: 'none',
          notification_slack_status: 'sent',
          notification_email_status: 'sent',
          created_at: '2026-03-20T10:00:00.000Z',
          first_response_due_at: '2026-03-20T14:00:00.000Z',
          resolution_due_at: '2026-03-24T10:00:00.000Z',
          last_operator_action_at: '2026-03-20T12:00:00.000Z',
          updated_at: '2026-03-25T10:00:00.000Z',
        },
        new Date('2026-04-08T12:00:00.000Z'),
      ),
    ]

    const summary = computeQueueSummary(tickets, { operatorUserId: 'op-1' })
    expect(summary.awaitingRetry).toBe(1)
    expect(summary.readyForKb).toBe(1)
    expect(summary.assignedToMe).toBe(2)
    expect(summary.escalated).toBe(2)
    expect(summary.escalatedLevel2).toBe(1)
    expect(summary.staleResolvedNotKb).toBe(1)

    vi.useRealTimers()
  })
})

describe('getSlaMetrics', () => {
  it('calculates lightweight SLA metrics from persisted ticket fields', () => {
    const tickets = [
      enrichTicketWithDerived(
        {
          ticket_id: 't-1',
          status: 'resolved',
          assigned_to: 'op-1',
          kb_approval_status: 'none',
          notification_slack_status: 'sent',
          notification_email_status: 'sent',
          created_at: '2026-04-05T08:00:00.000Z',
          updated_at: '2026-04-05T14:00:00.000Z',
          first_response_due_at: '2026-04-05T12:00:00.000Z',
          resolution_due_at: '2026-04-08T08:00:00.000Z',
          last_operator_action_at: '2026-04-05T10:00:00.000Z',
        },
        new Date('2026-04-08T12:00:00.000Z'),
      ),
      enrichTicketWithDerived(
        {
          ticket_id: 't-2',
          status: 'resolved',
          assigned_to: 'op-2',
          kb_approval_status: 'ingested',
          notification_slack_status: 'sent',
          notification_email_status: 'sent',
          created_at: '2026-04-06T08:00:00.000Z',
          updated_at: '2026-04-06T20:00:00.000Z',
          first_response_due_at: '2026-04-06T12:00:00.000Z',
          resolution_due_at: '2026-04-09T08:00:00.000Z',
          last_operator_action_at: '2026-04-06T11:00:00.000Z',
        },
        new Date('2026-04-08T12:00:00.000Z'),
      ),
      enrichTicketWithDerived(
        {
          ticket_id: 't-3',
          status: 'open',
          assigned_to: null,
          kb_approval_status: 'none',
          notification_slack_status: 'failed',
          notification_email_status: 'sent',
          created_at: '2026-04-07T08:00:00.000Z',
          updated_at: '2026-04-08T11:00:00.000Z',
          first_response_due_at: '2026-04-07T09:00:00.000Z',
          resolution_due_at: '2026-04-10T08:00:00.000Z',
          last_operator_action_at: null,
        },
        new Date('2026-04-08T12:00:00.000Z'),
      ),
    ]

    const metrics = getSlaMetrics(tickets, new Date('2026-04-08T12:00:00.000Z'))

    expect(metrics.avg_first_response_ms).toBe(9000000)
    expect(metrics.avg_resolution_ms).toBe(32400000)
    expect(metrics.overdue_count).toBe(1)
    expect(metrics.resolved_last_7_days).toBe(2)
    expect(metrics.created_last_7_days).toBe(3)
  })
})
