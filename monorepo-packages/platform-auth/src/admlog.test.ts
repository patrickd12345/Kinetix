import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  getAdmlogBlockReason,
  getAdmlogProductionBlockReason,
  isAdmlogProductionEnvironment,
  performAdmlogSignIn,
} from './admlog'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

describe('getAdmlogBlockReason', () => {
  const snapshot = { ...process.env }

  afterEach(() => {
    process.env = { ...snapshot }
  })

  it('returns production-safe copy when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.VERCEL_ENV
    delete process.env.ADMLOG_ENABLED
    delete process.env.BOOKIJI_TEST_MODE

    const r = getAdmlogBlockReason()
    expect(r.criteria).toEqual(['NODE_ENV or VERCEL_ENV is production'])
    expect(r.howToEnable).toMatch(/not available in production/i)
    expect(r.howToEnable).toMatch(/Vercel Production/i)
    expect(r.howToEnable).not.toMatch(/^Set ADMLOG_ENABLED=true/)
  })

  it('returns production-safe copy when VERCEL_ENV is production', () => {
    process.env.NODE_ENV = 'development'
    process.env.VERCEL_ENV = 'production'

    const r = getAdmlogBlockReason()
    expect(r.criteria).toEqual(['NODE_ENV or VERCEL_ENV is production'])
    expect(r.howToEnable).not.toContain('Set ADMLOG_ENABLED=true')
  })

  it('non-production: env-flag guidance when flags are unset', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.VERCEL_ENV
    delete process.env.ADMLOG_ENABLED
    delete process.env.BOOKIJI_TEST_MODE

    const r = getAdmlogBlockReason()
    expect(r.criteria).toContain('Neither ADMLOG_ENABLED nor BOOKIJI_TEST_MODE is set to "true"')
    expect(r.howToEnable).toContain('ADMLOG_ENABLED=true')
    expect(r.howToEnable).toContain('non-production')
  })

  it('getAdmlogProductionBlockReason matches production branch of getAdmlogBlockReason', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.VERCEL_ENV
    expect(getAdmlogProductionBlockReason()).toEqual(getAdmlogBlockReason())
  })
})

describe('isAdmlogProductionEnvironment', () => {
  const snapshot = { ...process.env }

  afterEach(() => {
    process.env = { ...snapshot }
  })

  it('is true when NODE_ENV or VERCEL_ENV is production', () => {
    process.env.NODE_ENV = 'production'
    expect(isAdmlogProductionEnvironment()).toBe(true)

    process.env.NODE_ENV = 'development'
    process.env.VERCEL_ENV = 'production'
    expect(isAdmlogProductionEnvironment()).toBe(true)
  })

  it('is false in non-production', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.VERCEL_ENV
    expect(isAdmlogProductionEnvironment()).toBe(false)
  })
})

describe('performAdmlogSignIn security', () => {
  const snapshot = { ...process.env }

  afterEach(() => {
    process.env = { ...snapshot }
    vi.clearAllMocks()
  })

  it('fails if ADMLOG_PASSWORD is missing even if BOOKIJI_TEST_MODE is true', async () => {
    process.env.BOOKIJI_TEST_MODE = 'true'
    delete process.env.ADMLOG_PASSWORD

    // This test is expected to FAIL before the fix because it will use DEFAULT_PASSWORD_LOCAL
    // instead of throwing the required error.
    await expect(
      performAdmlogSignIn({
        supabaseUrl: 'http://localhost:54321',
        serviceKey: 's',
        anonKey: 'a',
      })
    ).rejects.toThrow('ADMLOG_PASSWORD is required')
  })
})
