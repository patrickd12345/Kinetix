import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type MockRes = VercelResponse & { body?: unknown; headers: Record<string, unknown>; statusCode?: number }

function createRes(): MockRes {
  const res: Partial<MockRes> = {
    headers: {},
    status(code: number) {
      this.statusCode = code
      return this as VercelResponse
    },
    setHeader(name: string, value: unknown) {
      this.headers[name.toLowerCase()] = value
    },
    json(payload: unknown) {
      this.body = payload
      return this as VercelResponse
    },
    end() {
      return this as VercelResponse
    },
  }
  return res as MockRes
}

function createReq(overrides: Partial<VercelRequest>): VercelRequest {
  return {
    method: 'POST',
    headers: {},
    query: {},
    body: {},
    ...overrides,
  } as VercelRequest
}

async function loadHandler() {
  vi.resetModules()
  const module = await import('@api/escalationNotify')
  return module.default
}

describe('escalation notify route', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('returns 204 without calling Slack when webhook is not configured', async () => {
    const handler = await loadHandler()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const req = createReq({ body: { ticketId: 'ticket-1', escalationLevel: 2, title: 'Broken sync' } })
    const res = createRes()

    await handler(req, res)

    expect(res.statusCode).toBe(204)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('posts the escalation payload to Slack when configured', async () => {
    const handler = await loadHandler()
    vi.stubEnv('ESCALATION_SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/test')
    vi.stubEnv('KINETIX_APP_BASE_URL', 'https://kinetix.bookiji.com')
    vi.stubEnv('VERCEL_ENV', 'production')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    const req = createReq({
      body: {
        ticketId: 'ticket-1',
        escalationLevel: 2,
        title: 'Broken sync',
        createdAt: '2026-04-09T12:00:00.000Z',
        assignee: 'patrick',
        labels: ['overdue_resolution', 'ready_for_kb'],
      },
    })
    const res = createRes()

    await handler(req, res)

    expect(res.statusCode).toBe(204)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://hooks.slack.com/services/test')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(String(init?.body)).toContain('🚨 [PROD] Kinetix Escalation')
    expect(String(init?.body)).toContain('Ticket: ticket-1')
    expect(String(init?.body)).toContain('Level: 2')
    expect(String(init?.body)).toContain('Title: Broken sync')
    expect(String(init?.body)).toContain('Link: https://kinetix.bookiji.com/support-queue?ticketId=ticket-1')
    expect(String(init?.body)).toContain('Time: 2026-04-09T12:00:00.000Z')
    expect(String(init?.body)).toContain('Assignee: patrick')
    expect(String(init?.body)).toContain('Labels: overdue_resolution, ready_for_kb')
  })

  it('suppresses duplicate ticket and level notifications within the same resend bucket', async () => {
    const handler = await loadHandler()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-09T12:00:00.000Z'))
    vi.stubEnv('ESCALATION_SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/test')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
    const req = createReq({ body: { ticketId: 'ticket-1', escalationLevel: 2 } })

    await handler(req, createRes())
    await handler(req, createRes())

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('allows resend for the same ticket and level in a new day bucket', async () => {
    const handler = await loadHandler()
    vi.useFakeTimers()
    vi.stubEnv('ESCALATION_SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/test')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))

    vi.setSystemTime(new Date('2026-04-09T12:00:00.000Z'))
    await handler(createReq({ body: { ticketId: 'ticket-1', escalationLevel: 2 } }), createRes())

    vi.setSystemTime(new Date('2026-04-10T12:00:01.000Z'))
    await handler(createReq({ body: { ticketId: 'ticket-1', escalationLevel: 2 } }), createRes())

    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('sends again when the escalation level changes for the same ticket', async () => {
    const handler = await loadHandler()
    vi.stubEnv('ESCALATION_SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/test')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))

    await handler(createReq({ body: { ticketId: 'ticket-1', escalationLevel: 1 } }), createRes())
    await handler(createReq({ body: { ticketId: 'ticket-1', escalationLevel: 2 } }), createRes())

    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('returns 204 when server-side escalation is explicitly disabled', async () => {
    const handler = await loadHandler()
    vi.stubEnv('VITE_ENABLE_ESCALATION', 'false')
    vi.stubEnv('ESCALATION_SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/test')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const res = createRes()
    await handler(createReq({ body: { ticketId: 'ticket-1', escalationLevel: 2 } }), res)

    expect(res.statusCode).toBe(204)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid payload', async () => {
    const handler = await loadHandler()
    vi.stubEnv('ESCALATION_SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/test')
    const res = createRes()
    await handler(createReq({ body: { escalationLevel: 2 } }), res)

    expect(res.statusCode).toBe(400)
  })

  it('returns 405 for unsupported methods', async () => {
    const handler = await loadHandler()
    const res = createRes()
    await handler(createReq({ method: 'GET' }), res)

    expect(res.statusCode).toBe(405)
  })

  it('returns 204 and logs minimally when Slack delivery fails', async () => {
    const handler = await loadHandler()
    vi.stubEnv('ESCALATION_SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/test')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const res = createRes()
    await handler(createReq({ body: { ticketId: 'ticket-1', escalationLevel: 2 } }), res)

    expect(res.statusCode).toBe(204)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('suppresses sends after the per-minute rate limit is reached', async () => {
    const handler = await loadHandler()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-09T12:00:00.000Z'))
    vi.stubEnv('ESCALATION_SLACK_WEBHOOK_URL', 'https://hooks.slack.com/services/test')
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    for (let index = 0; index < 51; index += 1) {
      const res = createRes()
      await handler(
        createReq({ body: { ticketId: `ticket-${index}`, escalationLevel: 2 } }),
        res,
      )
      expect(res.statusCode).toBe(204)
    }

    expect(fetchSpy).toHaveBeenCalledTimes(50)
    expect(warnSpy).toHaveBeenCalledWith(
      'Escalation notification suppressed',
      expect.objectContaining({ reason: 'rate_limited' }),
    )
    warnSpy.mockRestore()
  })
})
