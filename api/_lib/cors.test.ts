import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const mockResolve = vi.hoisted(() => vi.fn())

vi.mock('./env/runtime', () => ({
  resolveKinetixRuntimeEnv: () => mockResolve(),
}))

import { applyCors } from './cors'

function createRes(): VercelResponse {
  const headers: Record<string, unknown> = {}
  return {
    setHeader(name: string, value: unknown) {
      headers[name.toLowerCase()] = value
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()]
    },
  } as VercelResponse
}

function reqWithOrigin(origin: string | undefined): VercelRequest {
  return {
    headers: origin ? { origin } : {},
  } as VercelRequest
}

describe('applyCors', () => {
  beforeEach(() => {
    mockResolve.mockReset()
  })

  it('development: empty allowlist stays permissive (wildcard) for browser requests', () => {
    mockResolve.mockReturnValue({
      corsAllowedOrigins: '',
      nodeEnv: 'development',
      vercelEnv: '',
    })

    const res = createRes()
    const out = applyCors(reqWithOrigin('https://evil.example'), res, {
      methods: ['POST', 'OPTIONS'],
      headers: ['Content-Type'],
    })

    expect(out.allowed).toBe(true)
    expect(res.getHeader('access-control-allow-origin')).toBe('*')
  })

  it('production: empty allowlist denies cross-origin (fail closed)', () => {
    mockResolve.mockReturnValue({
      corsAllowedOrigins: '',
      nodeEnv: 'production',
      vercelEnv: 'production',
    })

    const res = createRes()
    const out = applyCors(reqWithOrigin('https://kinetix.example'), res, {
      methods: ['POST', 'OPTIONS'],
      headers: ['Content-Type'],
    })

    expect(out.allowed).toBe(false)
    expect(res.getHeader('access-control-allow-origin')).toBe('null')
  })

  it('production: empty allowlist allows requests with no Origin header', () => {
    mockResolve.mockReturnValue({
      corsAllowedOrigins: '',
      nodeEnv: 'production',
      vercelEnv: 'production',
    })

    const res = createRes()
    const out = applyCors(reqWithOrigin(undefined), res, {
      methods: ['POST', 'OPTIONS'],
      headers: ['Content-Type'],
    })

    expect(out.allowed).toBe(true)
    expect(res.getHeader('access-control-allow-origin')).toBe('null')
  })

  it('preview: empty allowlist denies cross-origin', () => {
    mockResolve.mockReturnValue({
      corsAllowedOrigins: '',
      nodeEnv: 'development',
      vercelEnv: 'preview',
    })

    const res = createRes()
    const out = applyCors(reqWithOrigin('https://preview.example'), res, {
      methods: ['POST', 'OPTIONS'],
      headers: ['Content-Type'],
    })

    expect(out.allowed).toBe(false)
    expect(res.getHeader('access-control-allow-origin')).toBe('null')
  })

  it('production: explicit allowlist still permits matching origin', () => {
    mockResolve.mockReturnValue({
      corsAllowedOrigins: 'https://app.kinetix.example',
      nodeEnv: 'production',
      vercelEnv: 'production',
    })

    const res = createRes()
    const out = applyCors(reqWithOrigin('https://app.kinetix.example'), res, {
      methods: ['POST', 'OPTIONS'],
      headers: ['Content-Type'],
    })

    expect(out.allowed).toBe(true)
    expect(res.getHeader('access-control-allow-origin')).toBe('https://app.kinetix.example')
  })
})
