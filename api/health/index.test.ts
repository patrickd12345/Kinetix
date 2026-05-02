import { afterEach, describe, expect, it, vi } from 'vitest'

import handler, { GET } from './index.js'

function createResponse() {
  const res = {
    headers: new Map<string, string>(),
    statusCode: 0,
    body: undefined as unknown,
    setHeader: vi.fn((key: string, value: string) => {
      res.headers.set(key, value)
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code
      return res
    }),
    json: vi.fn((body: unknown) => {
      res.body = body
      return res
    }),
    end: vi.fn(() => res),
  }
  return res
}

describe('/api/health', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the public health payload from the fetch-style GET export', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-02T12:00:00.000Z'))

    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toEqual({
      status: 'ok',
      service: 'kinetix',
      timestamp: Date.parse('2026-05-02T12:00:00.000Z'),
    })
  })

  it('serves unauthenticated GET probes from the Vercel function handler', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-02T12:00:00.000Z'))
    const res = createResponse()

    await handler({ method: 'GET' } as never, res as never)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      status: 'ok',
      service: 'kinetix',
      timestamp: Date.parse('2026-05-02T12:00:00.000Z'),
    })
  })

  it('rejects unsupported methods without requiring auth or dependencies', async () => {
    const res = createResponse()

    await handler({ method: 'POST' } as never, res as never)

    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET, OPTIONS')
    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.json).toHaveBeenCalledWith({ error: 'method_not_allowed' })
  })
})
