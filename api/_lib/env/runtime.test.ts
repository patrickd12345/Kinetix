import { describe, it, expect } from 'vitest'
import { resolveKinetixRuntimeEnv } from './runtime'

describe('resolveKinetixRuntimeEnv — apiRequireAuth', () => {
  it('defaults to off in local dev when KINETIX_API_REQUIRE_AUTH is unset', () => {
    const env = resolveKinetixRuntimeEnv({
      NODE_ENV: 'development',
      VERCEL_ENV: '',
    } as NodeJS.ProcessEnv)
    expect(env.apiRequireAuth).toBe(false)
  })

  it('respects KINETIX_API_REQUIRE_AUTH=1 in local dev', () => {
    const env = resolveKinetixRuntimeEnv({
      NODE_ENV: 'development',
      VERCEL_ENV: '',
      KINETIX_API_REQUIRE_AUTH: '1',
    } as NodeJS.ProcessEnv)
    expect(env.apiRequireAuth).toBe(true)
  })

  it('forces auth on when NODE_ENV is production even if KINETIX_API_REQUIRE_AUTH is unset', () => {
    const env = resolveKinetixRuntimeEnv({
      NODE_ENV: 'production',
      VERCEL_ENV: '',
      KINETIX_API_REQUIRE_AUTH: '',
    } as NodeJS.ProcessEnv)
    expect(env.apiRequireAuth).toBe(true)
  })

  it('forces auth on for Vercel preview even when KINETIX_API_REQUIRE_AUTH is unset', () => {
    const env = resolveKinetixRuntimeEnv({
      NODE_ENV: 'development',
      VERCEL_ENV: 'preview',
      KINETIX_API_REQUIRE_AUTH: '',
    } as NodeJS.ProcessEnv)
    expect(env.apiRequireAuth).toBe(true)
  })

  it('forces auth on for Vercel production', () => {
    const env = resolveKinetixRuntimeEnv({
      NODE_ENV: 'development',
      VERCEL_ENV: 'production',
      KINETIX_API_REQUIRE_AUTH: '',
    } as NodeJS.ProcessEnv)
    expect(env.apiRequireAuth).toBe(true)
  })
})
