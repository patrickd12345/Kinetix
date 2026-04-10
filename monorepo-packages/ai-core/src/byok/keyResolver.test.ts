import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolveKey } from './keyResolver.js'
import { setUserKeyLoader } from './keyStorage.js'

describe('resolveKey', () => {
  beforeEach(() => {
    setUserKeyLoader(null)
    vi.unstubAllEnvs()
  })

  it('returns platform gateway key when no user key', async () => {
    vi.stubEnv('VERCEL_VIRTUAL_KEY', 'vkey-platform-test-12345678')
    const r = await resolveKey({
      userId: 'u1',
      provider: 'gateway',
      product: 'kinetix',
    })
    expect(r.source).toBe('platform')
    expect(r.apiKey).toBe('vkey-platform-test-12345678')
  })

  it('returns user openai key for gateway when loader provides sk-', async () => {
    vi.stubEnv('VERCEL_VIRTUAL_KEY', 'vkey-platform-test-12345678')
    setUserKeyLoader(async (_uid, provider) => {
      if (provider === 'openai') {
        return 'sk-testuser123456789012345678901234'
      }
      return null
    })
    const r = await resolveKey({
      userId: 'u1',
      provider: 'gateway',
      product: 'kinetix',
    })
    expect(r.source).toBe('user')
    expect(r.apiKey.startsWith('sk-')).toBe(true)
  })
})
