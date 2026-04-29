import { describe, expect, it } from 'vitest'
import { formatOptionalIntegrationError } from './runtime'

describe('formatOptionalIntegrationError', () => {
  it('softens generic fetch failures for UI', () => {
    expect(formatOptionalIntegrationError(new Error('Failed to fetch'))).toBe(
      'Network unavailable. Try again later.',
    )
  })

  it('preserves specific non-network errors', () => {
    expect(formatOptionalIntegrationError(new Error('invalid token'))).toBe('invalid token')
  })
})
