import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const assertKinetixCheckoutEnvMock = vi.hoisted(() => vi.fn())
const getKinetixStripeOrThrowMock = vi.hoisted(() => vi.fn())
const createClientMock = vi.hoisted(() => vi.fn())
const createCheckoutSessionMock = vi.hoisted(() => vi.fn())
const resolveRuntimeMock = vi.hoisted(() => vi.fn())

vi.mock('../../_lib/cors', () => ({
  applyCors: vi.fn(() => ({ allowed: true })),
}))

vi.mock('../../_lib/kinetixStripe', () => ({
  assertKinetixCheckoutEnv: assertKinetixCheckoutEnvMock,
  getKinetixStripeOrThrow: getKinetixStripeOrThrowMock,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

vi.mock('@bookiji-inc/stripe-runtime', () => ({
  createKinetixSubscriptionCheckoutSession: createCheckoutSessionMock,
}))

vi.mock('../../_lib/env/runtime', () => ({
  resolveKinetixRuntimeEnv: resolveRuntimeMock,
}))

vi.mock('../../_lib/observability', () => ({
  logApiEvent: vi.fn(),
}))

import handler from './index'

type MockRes = VercelResponse & { body?: unknown; statusCode?: number }

function createRes(): MockRes {
  const res: Partial<MockRes> = {
    status(code: number) {
      this.statusCode = code
      return this as VercelResponse
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

function baseReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: {
      'x-request-id': 'req_checkout_test',
      ...((overrides.headers as Record<string, string>) ?? {}),
    },
    query: {},
    body: {},
    ...overrides,
  } as VercelRequest
}

describe('create-checkout-session error contract', () => {
  beforeEach(() => {
    assertKinetixCheckoutEnvMock.mockReset()
    getKinetixStripeOrThrowMock.mockReset()
    createClientMock.mockReset()
    createCheckoutSessionMock.mockReset()
    resolveRuntimeMock.mockReset()
  })

  it('returns canonical error JSON with code and requestId when billing is unavailable', async () => {
    assertKinetixCheckoutEnvMock.mockReturnValue({
      ok: false,
      message: 'Billing is disabled (set BILLING_ENABLED=true).',
    })

    const res = createRes()
    await handler(baseReq(), res)

    expect(res.statusCode).toBe(503)
    expect(res.body).toMatchObject({
      code: 'billing_unavailable',
      message: 'Billing is disabled (set BILLING_ENABLED=true).',
      requestId: 'req_checkout_test',
    })
    expect((res.body as { error?: string }).error).toBe(
      'Billing is disabled (set BILLING_ENABLED=true).',
    )
  })

  it('returns canonical error when Bearer token is missing', async () => {
    assertKinetixCheckoutEnvMock.mockReturnValue({ ok: true })
    resolveRuntimeMock.mockReturnValue({
      supabaseUrl: 'https://x.supabase.co',
      supabaseAnonKey: 'anon',
      kinetixStripePriceId: 'price_123',
    })

    const res = createRes()
    await handler(
      baseReq({
        headers: { 'x-request-id': 'req_auth' },
      }),
      res,
    )

    expect(res.statusCode).toBe(401)
    expect(res.body).toMatchObject({
      code: 'unauthorized',
      message: 'Authorization Bearer token required',
      requestId: 'req_auth',
    })
  })
})
