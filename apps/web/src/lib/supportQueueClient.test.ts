import { describe, expect, it } from 'vitest'
import { normalizeSupportQueueListPayload } from './supportQueueClient'

describe('normalizeSupportQueueListPayload', () => {
  it('fills in empty tickets when missing', () => {
    const out = normalizeSupportQueueListPayload({})
    expect(out.tickets).toEqual([])
    expect(out.summary.unassigned).toBe(0)
    expect(out.slaMetrics.overdue_count).toBe(0)
  })

  it('preserves tickets when present', () => {
    const t = {
      ticket_id: 'a',
      status: 'open',
      severity: null,
      issue_summary: 'x',
      internal_notes: '',
      notification_slack_status: 'pending',
      notification_email_status: 'pending',
      notification_error_summary: '',
      notification_last_attempt_at: null,
      kb_approval_status: 'none',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: null,
    }
    const out = normalizeSupportQueueListPayload({ tickets: [t] })
    expect(out.tickets).toHaveLength(1)
    expect(out.tickets[0].ticket_id).toBe('a')
  })
})
