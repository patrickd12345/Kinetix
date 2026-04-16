import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupportQueueTicket } from '../supportQueueClient'

const sendEscalationNotificationMock = vi.hoisted(() => vi.fn())

vi.mock('./notify', () => ({
  sendEscalationNotification: sendEscalationNotificationMock,
}))

function buildTicket(overrides: Partial<SupportQueueTicket> = {}): SupportQueueTicket {
  return {
    ticket_id: 'ticket-1',
    status: 'open',
    severity: 'high',
    issue_summary: 'Escalated issue',
    internal_notes: '',
    notification_slack_status: 'pending',
    notification_email_status: 'pending',
    notification_error_summary: '',
    notification_last_attempt_at: null,
    kb_approval_status: 'none',
    created_at: '2026-04-09T12:00:00.000Z',
    updated_at: '2026-04-09T12:00:00.000Z',
    assigned_to: null,
    assigned_at: null,
    first_response_due_at: '2026-04-09T12:15:00.000Z',
    resolution_due_at: '2026-04-09T16:00:00.000Z',
    last_operator_action_at: null,
    metadata: null,
    derived: {
      labels: ['overdue_first_response'],
      nowIso: '2026-04-09T12:30:00.000Z',
      escalation_level: 2,
    },
    ...overrides,
  }
}

describe('helpcenter escalation notifications', () => {
  beforeEach(async () => {
    vi.unstubAllEnvs()
    sendEscalationNotificationMock.mockReset()
    const mod = await import('./escalation')
    mod.__resetEscalationNotificationStateForTests()
  })

  it('sends at most one notification per ticket id', async () => {
    vi.stubEnv('VITE_ENABLE_ESCALATION', 'true')
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const mod = await import('./escalation')
    const ticket = buildTicket()

    mod.notifyEscalation(ticket)
    mod.notifyEscalation(ticket)

    expect(sendEscalationNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendEscalationNotificationMock).toHaveBeenCalledWith({
      ticketId: 'ticket-1',
      escalationLevel: 2,
      title: 'Escalated issue',
      createdAt: '2026-04-09T12:00:00.000Z',
      assignee: undefined,
      labels: ['overdue_first_response'],
    })
    expect(consoleSpy).toHaveBeenCalledTimes(1)
    consoleSpy.mockRestore()
  })

  it('does nothing when escalation notifications are disabled', async () => {
    vi.stubEnv('VITE_ENABLE_ESCALATION', 'false')
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const mod = await import('./escalation')

    mod.notifyEscalation(buildTicket())

    expect(sendEscalationNotificationMock).not.toHaveBeenCalled()
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('includes optional assignee and labels when available', async () => {
    vi.stubEnv('VITE_ENABLE_ESCALATION', 'true')
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const mod = await import('./escalation')

    mod.notifyEscalation(buildTicket({
      assigned_to: 'patrick',
      derived: {
        labels: ['overdue_resolution', 'ready_for_kb'],
        nowIso: '2026-04-09T12:30:00.000Z',
        escalation_level: 2,
      },
    }))

    expect(sendEscalationNotificationMock).toHaveBeenCalledWith({
      ticketId: 'ticket-1',
      escalationLevel: 2,
      title: 'Escalated issue',
      createdAt: '2026-04-09T12:00:00.000Z',
      assignee: 'patrick',
      labels: ['overdue_resolution', 'ready_for_kb'],
    })
    consoleSpy.mockRestore()
  })
})
