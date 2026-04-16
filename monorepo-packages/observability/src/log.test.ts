import { describe, expect, it, vi } from 'vitest'
import { emitStructuredLog, emitStripeLog, getRequestId } from './index'

describe('observability request ids', () => {
  it('preserves an incoming request id and generates one when missing', () => {
    expect(getRequestId('req_123')).toBe('req_123')
    expect(typeof getRequestId()).toBe('string')
  })
})

describe('observability structured logs', () => {
  it('emits structured log lines through a custom sink', () => {
    const sink = vi.fn()
    emitStructuredLog('info', 'test_event', { ok: true }, { sink })
    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink.mock.calls[0]?.[2]).toMatchObject({
      event: 'test_event',
      level: 'info',
      ok: true,
    })
  })

  it('builds Stripe log fields', () => {
    const sink = vi.fn()
    emitStripeLog(
      'info',
      'stripe_signature_verification',
      {
        eventId: 'evt_1',
        eventType: 'invoice.paid',
        signatureResult: 'verified',
        requestId: 'req_1',
      },
      { sink },
    )

    expect(sink).toHaveBeenCalledTimes(1)
  })
})
