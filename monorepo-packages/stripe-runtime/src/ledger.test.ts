import { describe, expect, it } from 'vitest'
import {
  buildStripeFailedUpdate,
  buildStripeLedgerClaim,
  buildStripeProcessedUpdate,
  claimStripeEvent,
  isBillingEnabled,
  isStripeDuplicateError,
} from './index'

describe('stripe-runtime ledger helpers', () => {
  it('builds canonical claim payloads', () => {
    const claim = buildStripeLedgerClaim({
      eventId: 'evt_1',
      eventType: 'invoice.paid',
      product: 'bookiji',
      accountScope: 'platform',
      receivedAt: '2026-03-28T00:00:00.000Z',
    })

    expect(claim).toEqual({
      event_id: 'evt_1',
      event_type: 'invoice.paid',
      received_at: '2026-03-28T00:00:00.000Z',
      processed_at: null,
      status: 'claimed',
      error: null,
      product: 'bookiji',
      account_scope: 'platform',
    })
  })

  it('builds processed and failed updates', () => {
    expect(buildStripeProcessedUpdate('2026-03-28T00:00:00.000Z')).toEqual({
      processed_at: '2026-03-28T00:00:00.000Z',
      status: 'processed',
      error: null,
    })

    expect(buildStripeFailedUpdate('boom', '2026-03-28T00:00:00.000Z')).toEqual({
      processed_at: '2026-03-28T00:00:00.000Z',
      status: 'failed',
      error: 'boom',
    })
  })

  it('detects duplicate-key errors and normalizes claim results', async () => {
    expect(isStripeDuplicateError({ code: '23505' })).toBe(true)

    const duplicate = await claimStripeEvent({
      eventId: 'evt_dup',
      eventType: 'payment_intent.succeeded',
      product: 'bookiji',
      accountScope: 'platform',
      insertClaim: async () => ({ error: { code: '23505' } }),
    })

    expect(duplicate.claimed).toBe(false)
    expect(duplicate.duplicate).toBe(true)
  })
})

describe('stripe-runtime billing gate', () => {
  it('defaults billing disabled and honors explicit true', () => {
    expect(isBillingEnabled({})).toBe(false)
    expect(isBillingEnabled({ BILLING_ENABLED: 'true' })).toBe(true)
  })
})
