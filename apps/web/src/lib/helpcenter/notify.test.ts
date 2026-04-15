import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendEscalationNotification } from './notify'

describe('helpcenter notify helper', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('posts best-effort to the configured proxy URL', async () => {
    vi.stubEnv('VITE_ESCALATION_PROXY_URL', '/api/escalationNotify')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))

    await sendEscalationNotification({
      ticketId: 'ticket-1',
      escalationLevel: 2,
      title: 'Broken sync',
      createdAt: '2026-04-09T12:00:00.000Z',
      assignee: 'patrick',
      labels: ['overdue_resolution'],
    })

    expect(fetchSpy).toHaveBeenCalledWith('/api/escalationNotify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId: 'ticket-1',
        escalationLevel: 2,
        title: 'Broken sync',
        createdAt: '2026-04-09T12:00:00.000Z',
        assignee: 'patrick',
        labels: ['overdue_resolution'],
      }),
    })
  })

  it('swallows fetch failures so UI callers never fail', async () => {
    vi.stubEnv('VITE_ESCALATION_PROXY_URL', '/api/escalationNotify')
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))

    await expect(
      sendEscalationNotification({
        ticketId: 'ticket-1',
        escalationLevel: 2,
      }),
    ).resolves.toBeUndefined()
  })
})
