import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeEnv = {
  kinetixAppBaseUrl: 'https://kinetix.test',
  kinetixSupportSlackWebhookUrl: 'https://slack.test/webhook',
  kinetixSupportEmailTo: 'ops@kinetix.test',
  kinetixSupportEmailFrom: 'Kinetix <support@kinetix.test>',
  resendApiKey: 're_test',
}

vi.mock('./env/runtime.js', () => ({
  resolveKinetixRuntimeEnv: () => runtimeEnv,
}))

import { dispatchTicketNotifications } from './supportNotifications'

describe('dispatchTicketNotifications', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('converts network errors into failed notification states', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )

    const result = await dispatchTicketNotifications({
      ticket_id: 'kinetix-20260408-abcdef',
      issue_summary: 'Support request',
      severity: 'medium',
      metadata: { inferred_topic: 'sync', retrieval_state: 'retrieval_weak' },
    })

    expect(result.slackStatus).toBe('failed')
    expect(result.emailStatus).toBe('failed')
    expect(result.errorSummary).toContain('slack:network')
    expect(result.errorSummary).toContain('email:network')
  })
})
