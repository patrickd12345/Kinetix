import { describe, it, expect, afterEach } from 'vitest'
import {
  getAdmlogBlockReason,
  getAdmlogProductionBlockReason,
  isAdmlogProductionEnvironment,
} from './admlog'

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
