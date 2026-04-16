import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createKinetixSubscriptionCheckoutSession, KINETIX_PRODUCT_KEY } from './kinetixCheckoutSession'

describe('createKinetixSubscriptionCheckoutSession', () => {
  const create = vi.fn(async () => ({ id: 'cs_test_1', url: 'https://checkout.test/cs_test_1' }))

  beforeEach(() => {
    create.mockClear()
  })

  it('passes kinetix metadata on session and subscription_data', async () => {
    const stripe = { checkout: { sessions: { create } } } as any
    const r = await createKinetixSubscriptionCheckoutSession(stripe, {
      priceId: 'price_123',
      userId: 'user-uuid',
      email: 'a@b.com',
      successUrl: 'https://app/success',
      cancelUrl: 'https://app/cancel',
    })
    expect(r.sessionId).toBe('cs_test_1')
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        metadata: expect.objectContaining({
          product_key: KINETIX_PRODUCT_KEY,
          user_id: 'user-uuid',
          entitlement_key: 'default',
        }),
        subscription_data: {
          metadata: expect.objectContaining({
            product_key: KINETIX_PRODUCT_KEY,
            user_id: 'user-uuid',
            entitlement_key: 'default',
          }),
        },
      })
    )
  })
})
