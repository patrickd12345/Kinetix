import { describe, expect, it } from 'vitest'
import { formatSupabaseAuthError } from './supabaseAuthErrors'

describe('formatSupabaseAuthError', () => {
  it('maps HTTP 429 to rate-limit guidance', () => {
    expect(formatSupabaseAuthError({ status: 429, message: 'rate limit' })).toBe(
      'Too many sign-in attempts. Please wait a minute before requesting another magic link.'
    )
  })

  it('passes through Error message when no status', () => {
    expect(formatSupabaseAuthError(new Error('Network down'))).toBe('Network down')
  })
})
