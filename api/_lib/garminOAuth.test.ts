import { describe, expect, it, vi, beforeEach, afterEach, afterAll } from 'vitest'
import {
  exchangeGarminAuthorizationCode,
  garminAccessTokenExpiresAtSeconds,
  GarminAuthError,
  refreshGarminAccessToken,
} from './garminOAuth'

describe('garminAccessTokenExpiresAtSeconds', () => {
  afterAll(() => {
    vi.useRealTimers()
  })

  it('subtracts safety margin from expires_in', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'))
    expect(garminAccessTokenExpiresAtSeconds(86400, 600)).toBe(
      Math.floor(Date.now() / 1000) + 86400 - 600
    )
  })
})

describe('exchangeGarminAuthorizationCode', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'a',
              refresh_token: 'r',
              expires_in: 86400,
              token_type: 'bearer',
            }),
        } as Response)
      )
    )
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('POSTs form body to Garmin token URL', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    await exchangeGarminAuthorizationCode({
      code: 'c',
      codeVerifier: 'v',
      clientId: 'id',
      clientSecret: 'secret',
      redirectUri: 'https://app.example/settings',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://diauth.garmin.com/di-oauth2-service/oauth/token')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/x-www-form-urlencoded' })
    expect(String(init.body)).toContain('grant_type=authorization_code')
    expect(String(init.body)).toContain('code_verifier=v')
    expect(String(init.body)).toContain('redirect_uri=https%3A%2F%2Fapp.example%2Fsettings')
  })

  it('throws GarminAuthError on error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: 'invalid_grant', error_description: 'bad code' }),
        } as Response)
      )
    )
    await expect(
      exchangeGarminAuthorizationCode({
        code: 'x',
        codeVerifier: 'v',
        clientId: 'id',
        clientSecret: 'secret',
      })
    ).rejects.toThrow(GarminAuthError)
  })
})

describe('refreshGarminAccessToken', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'a2',
              refresh_token: 'r2',
              expires_in: 86400,
              token_type: 'bearer',
            }),
        } as Response)
      )
    )
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('sends refresh_token grant', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    await refreshGarminAccessToken({
      refreshToken: 'r',
      clientId: 'id',
      clientSecret: 'secret',
    })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(init.body)).toContain('grant_type=refresh_token')
    expect(String(init.body)).toContain('refresh_token=r')
  })
})
