import { describe, expect, it, vi } from 'vitest'
import { buildAiLogFields, emitAiLog, emitStructuredLog, emitStripeLog, getRequestId } from './index'

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

  it('builds AI and Stripe log fields', () => {
    expect(
      buildAiLogFields({
        provider: 'gateway',
        model: 'gpt-4o-mini',
        mode: 'gateway',
        latencyMs: 42,
        fallbackReason: null,
      }),
    ).toMatchObject({
      provider: 'gateway',
      latencyMs: 42,
      fallback: false,
      fallbackReason: null,
    })

    expect(
      buildAiLogFields(
        {
          provider: 'gateway',
          model: 'gpt-4o-mini',
          mode: 'gateway',
          latencyMs: 120,
          fallbackReason: 'Rate limit exceeded',
        },
        { customField: 'customValue', anotherField: 123 }
      ),
    ).toMatchObject({
      provider: 'gateway',
      model: 'gpt-4o-mini',
      mode: 'gateway',
      latencyMs: 120,
      fallback: true,
      fallbackReason: 'Rate limit exceeded',
      customField: 'customValue',
      anotherField: 123,
    })

    const sink = vi.fn()
    emitAiLog(
      'info',
      'ai_execution',
      {
        provider: 'ollama',
        model: 'llama3.2',
        mode: 'ollama',
        latencyMs: 12,
        fallbackReason: null,
      },
      { surface: 'assistant' },
      { sink },
    )
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

    expect(sink).toHaveBeenCalledTimes(2)
  })
})
