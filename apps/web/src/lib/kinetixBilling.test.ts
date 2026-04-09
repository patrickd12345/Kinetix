import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createKinetixCheckoutSession } from './kinetixBilling'

describe('createKinetixCheckoutSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns url on success', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://checkout.stripe.test/session' }), { status: 200 }),
    )

    const result = await createKinetixCheckoutSession({
      accessToken: 'token-1',
      successUrl: 'http://localhost/billing/success',
      cancelUrl: 'http://localhost/billing/cancel',
    })

    expect(result).toEqual({ ok: true, url: 'https://checkout.stripe.test/session' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('maps 503 to billing_unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({}), { status: 503 }))

    const result = await createKinetixCheckoutSession({
      accessToken: 'token-1',
      successUrl: 'http://localhost/billing/success',
      cancelUrl: 'http://localhost/billing/cancel',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('billing_unavailable')
    }
  })

  it('maps generic non-2xx to checkout_failed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'checkout_failed' }), { status: 500 }),
    )

    const result = await createKinetixCheckoutSession({
      accessToken: 'token-1',
      successUrl: 'http://localhost/billing/success',
      cancelUrl: 'http://localhost/billing/cancel',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('checkout_failed')
    }
  })

  it('maps 401 to unauthorized', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({}), { status: 401 }))

    const result = await createKinetixCheckoutSession({
      accessToken: 'token-1',
      successUrl: 'http://localhost/billing/success',
      cancelUrl: 'http://localhost/billing/cancel',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('unauthorized')
    }
  })

  it('fails checkout when 2xx response has no url', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))

    const result = await createKinetixCheckoutSession({
      accessToken: 'token-1',
      successUrl: 'http://localhost/billing/success',
      cancelUrl: 'http://localhost/billing/cancel',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('checkout_failed')
    }
  })

  it('fails checkout when 2xx response body is not valid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not-json', { status: 200 }))

    const result = await createKinetixCheckoutSession({
      accessToken: 'token-1',
      successUrl: 'http://localhost/billing/success',
      cancelUrl: 'http://localhost/billing/cancel',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('checkout_failed')
    }
  })

  it('treats non-OK as checkout_failed even if a url is present', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://checkout.stripe.test/session' }), { status: 500 }),
    )

    const result = await createKinetixCheckoutSession({
      accessToken: 'token-1',
      successUrl: 'http://localhost/billing/success',
      cancelUrl: 'http://localhost/billing/cancel',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('checkout_failed')
    }
  })

  it('maps network failure to network_error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))

    const result = await createKinetixCheckoutSession({
      accessToken: 'token-1',
      successUrl: 'http://localhost/billing/success',
      cancelUrl: 'http://localhost/billing/cancel',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('network_error')
    }
  })

  it('treats missing access token as unauthorized and does not call fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await createKinetixCheckoutSession({
      accessToken: undefined,
      successUrl: 'http://localhost/billing/success',
      cancelUrl: 'http://localhost/billing/cancel',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('unauthorized')
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
