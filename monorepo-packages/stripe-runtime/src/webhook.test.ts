import { describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { verifyStripeWebhookSignature } from './index'

describe('stripe-runtime webhook helpers', () => {
  it('delegates signature verification to Stripe', () => {
    const constructEvent = vi.fn(
      () => ({ id: 'evt_123', type: 'invoice.paid' }) as Stripe.Event,
    )
    const stripe = {
      webhooks: {
        constructEvent,
      },
    }

    const event = verifyStripeWebhookSignature({
      stripe,
      payload: '{}',
      signature: 'sig',
      webhookSecret: 'whsec_test',
    })

    expect(constructEvent).toHaveBeenCalledWith('{}', 'sig', 'whsec_test')
    expect(event).toEqual({ id: 'evt_123', type: 'invoice.paid' })
  })

  it('propagates errors from Stripe verification', () => {
    const constructEvent = vi.fn(() => {
      throw new Error('Invalid signature')
    })
    const stripe = {
      webhooks: {
        constructEvent,
      },
    }

    expect(() =>
      verifyStripeWebhookSignature({
        stripe,
        payload: '{}',
        signature: 'invalid_sig',
        webhookSecret: 'whsec_test',
      }),
    ).toThrow('Invalid signature')
  })
})
