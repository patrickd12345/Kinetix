/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WITHINGS_API } from './withingsOAuthServer'

describe('withingsOAuthServer', () => {
  const clientId = 'test-client-id'
  const clientSecret = 'test-client-secret'

  beforeEach(() => {
    vi.resetModules()
  })

  it('withingsGetNonce returns nonce when API returns status 0 and body.nonce', async () => {
    const mockFetch = vi.fn()
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 0, body: { nonce: 'test-nonce-123' } }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const { withingsGetNonce } = await import('./withingsOAuthServer')
    const nonce = await withingsGetNonce(clientId, clientSecret)

    expect(nonce).toBe('test-nonce-123')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toContain('/v2/signature')
  })

  it(
    'withingsGetNonce throws friendly message when status 503 after retries',
    async () => {
      const mockFetch = vi.fn()
      for (let i = 0; i <= 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 503, body: {} }),
        })
      }
      vi.stubGlobal('fetch', mockFetch)

      const { withingsGetNonce } = await import('./withingsOAuthServer')

      await expect(withingsGetNonce(clientId, clientSecret)).rejects.toThrow(
        /Withings returned an error \(503/
      )
      expect(mockFetch).toHaveBeenCalledTimes(4)
    },
    { timeout: 15000 }
  )

  it('withingsGetNonce succeeds on second attempt after 503', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 503, body: {} }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 0, body: { nonce: 'retry-nonce' } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { withingsGetNonce } = await import('./withingsOAuthServer')
    const nonce = await withingsGetNonce(clientId, clientSecret)

    expect(nonce).toBe('retry-nonce')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('withingsRequestToken returns tokens when getnonce and oauth2 succeed', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 0, body: { nonce: 'n1' } }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 0,
        body: {
          access_token: 'at',
          refresh_token: 'rt',
          userid: 42,
          expires_in: 3600,
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { withingsRequestToken } = await import('./withingsOAuthServer')
    const result = await withingsRequestToken(clientId, clientSecret, {
      action: 'requesttoken',
      client_id: clientId,
      redirect_uri: 'http://localhost/settings',
      code: 'auth-code',
      grant_type: 'authorization_code',
    })

    expect(result.access_token).toBe('at')
    expect(result.refresh_token).toBe('rt')
    expect(result.userid).toBe(42)
    expect(result.expires_in).toBe(3600)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[1][0]).toBe(`${WITHINGS_API}/v2/oauth2`)
  })
})
