import type { VercelRequest, VercelResponse } from '@vercel/node'
import { describe, expect, it } from 'vitest'
import handler from '../../../../api/withings/index'

type MockRes = VercelResponse & {
  headers: Record<string, unknown>
  statusCode?: number
}

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
    end() {
      return this as VercelResponse
    },
  }
  return res as MockRes
}

function createReq(overrides: Partial<VercelRequest>): VercelRequest {
  return {
    method: 'GET',
    headers: {},
    query: {},
    body: {},
    ...overrides,
  } as VercelRequest
}

describe('Withings browser OAuth callback route', () => {
  it('redirects the Withings GET callback back to Settings with OAuth query params', async () => {
    const res = createRes()

    await handler(
      createReq({
        query: {
          code: 'withings-code',
          state: 'withings',
        },
      }),
      res,
    )

    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('/settings?code=withings-code&state=withings')
    expect(res.headers['access-control-allow-methods']).toBe('GET, POST, OPTIONS')
  })
})
