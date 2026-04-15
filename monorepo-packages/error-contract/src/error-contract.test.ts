import { describe, expect, it } from 'vitest'

import { buildError, getOrCreateRequestId, toHttpError } from './index'

describe('@bookiji-inc/error-contract', () => {
  it('buildError returns the canonical shape with only code and message', () => {
    expect(buildError('missing_signature', 'Missing stripe-signature header')).toEqual({
      code: 'missing_signature',
      message: 'Missing stripe-signature header',
    })
  })

  it('buildError includes details and requestId when provided', () => {
    expect(
      buildError('invalid_signature', 'Webhook signature verification failed', 'boom', 'req_123'),
    ).toEqual({
      code: 'invalid_signature',
      message: 'Webhook signature verification failed',
      details: 'boom',
      requestId: 'req_123',
    })
  })

  it('getOrCreateRequestId preserves an incoming string id', () => {
    expect(getOrCreateRequestId('req_from_string')).toBe('req_from_string')
  })

  it('getOrCreateRequestId reads x-request-id from Headers', () => {
    const headers = new Headers({ 'x-request-id': 'req_from_headers' })
    expect(getOrCreateRequestId(headers)).toBe('req_from_headers')
  })

  it('getOrCreateRequestId reads x-request-id from Request', () => {
    const request = new Request('http://localhost/test', {
      headers: { 'x-request-id': 'req_from_request' },
    })
    expect(getOrCreateRequestId(request)).toBe('req_from_request')
  })

  it('getOrCreateRequestId generates a UUID when missing', () => {
    expect(getOrCreateRequestId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('toHttpError preserves an already-typed error', () => {
    expect(
      toHttpError({
        code: 'billing_disabled',
        message: 'Billing is disabled.',
        details: 'flag off',
        requestId: 'req_999',
        status: 503,
      }),
    ).toEqual({
      code: 'billing_disabled',
      message: 'Billing is disabled.',
      details: 'flag off',
      requestId: 'req_999',
      status: 503,
    })
  })

  it('toHttpError converts an unknown error into a safe default', () => {
    expect(toHttpError({ nope: true })).toEqual({
      code: 'internal_error',
      message: 'Internal Server Error',
      status: 500,
    })
  })

  it('toHttpError redacts secret-like tokens from messages', () => {
    expect(toHttpError(new Error('failed with sk-secret-token-12345'))).toEqual({
      code: 'internal_error',
      message: 'failed with [redacted]',
      status: 500,
    })
  })
})
