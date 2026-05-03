import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  withingsHmac,
  withingsGetNonce,
  withingsRequestToken,
  exchangeWithingsCode,
  refreshWithingsToken,
  WITHINGS_API,
} from './withingsAuth'

describe('withingsHmac', () => {
  it('should generate correct HMAC SHA256 hex string', () => {
    const key = 'secret'
    const message = 'hello'
    // Expected HMAC for 'hello' with key 'secret' (SHA256)
    // echo -n "hello" | openssl dgst -sha256 -hmac "secret"
    const expected = '88a56247e2962117a2d782356c326442654d0089679462660d51ee914376483a'
    expect(withingsHmac(key, message)).toBe(expected)
  })
})

describe('withingsGetNonce', () => {
  const clientId = 'test_client_id'
  const clientSecret = 'test_client_secret'

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(1600000000000)) // 2020-09-13T12:26:40Z
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should return nonce on successful response', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 0,
        body: { nonce: 'test_nonce' },
      }),
    } as Response)

    const nonce = await withingsGetNonce(clientId, clientSecret)

    expect(nonce).toBe('test_nonce')
    expect(fetchMock).toHaveBeenCalledWith(
      `${WITHINGS_API}/v2/signature`,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('action=getnonce'),
      })
    )
    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body)
    expect(body.get('action')).toBe('getnonce')
    expect(body.get('client_id')).toBe(clientId)
    expect(body.get('timestamp')).toBe('1600000000')
    expect(body.get('signature')).toBeDefined()
  })

  it('should retry on 502/503/504 status and eventually succeed', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>

    // First attempt fails with 503
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 503 }),
    } as Response)

    // Second attempt succeeds
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 0,
        body: { nonce: 'retry_nonce' },
      }),
    } as Response)

    const noncePromise = withingsGetNonce(clientId, clientSecret)

    // Fast-forward through the retry delay
    await vi.runAllTimersAsync()

    const nonce = await noncePromise
    expect(nonce).toBe('retry_nonce')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('should throw error after max retries', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 503 }),
    } as Response)

    const noncePromise = withingsGetNonce(clientId, clientSecret)

    await vi.runAllTimersAsync()

    await expect(noncePromise).rejects.toThrow('Withings returned an error (503/502/504)')
  })

  it('should throw on non-zero status without retry', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 401,
        body: { error: 'invalid credentials' },
      }),
    } as Response)

    await expect(withingsGetNonce(clientId, clientSecret)).rejects.toThrow('invalid credentials')
  })

  it('should throw if nonce is missing in body', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 0,
        body: {},
      }),
    } as Response)

    await expect(withingsGetNonce(clientId, clientSecret)).rejects.toThrow('Withings getnonce: no nonce in response')
  })

  it('should throw if res.ok is false', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'internal server error' }),
    } as Response)

    await expect(withingsGetNonce(clientId, clientSecret)).rejects.toThrow('internal server error')
  })
})

describe('withingsRequestToken', () => {
  const clientId = 'id'
  const clientSecret = 'secret'
  const bodyParams = { code: 'abc', grant_type: 'authorization_code' }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should request token successfully', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>

    // Mock getnonce call
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 0,
        body: { nonce: 'nonce123' },
      }),
    } as Response)

    // Mock oauth2 token call
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 0,
        body: {
          access_token: 'at',
          refresh_token: 'rt',
          userid: 123,
          expires_in: 3600,
        },
      }),
    } as Response)

    const result = await withingsRequestToken(clientId, clientSecret, bodyParams)

    expect(result).toEqual({
      access_token: 'at',
      refresh_token: 'rt',
      userid: 123,
      expires_in: 3600,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe(`${WITHINGS_API}/v2/oauth2`)
    expect(init.body).toContain('nonce=nonce123')
    expect(init.body).toContain('code=abc')
  })

  it('should throw if token request fails (res.ok false)', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 0, body: { nonce: 'n' } }),
    } as Response)
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_code' }),
    } as Response)

    await expect(withingsRequestToken(clientId, clientSecret, bodyParams)).rejects.toThrow('invalid_code')
  })

  it('should throw if status is non-zero', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 0, body: { nonce: 'n' } }),
    } as Response)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 100, error: 'some withings error' }),
    } as Response)

    await expect(withingsRequestToken(clientId, clientSecret, bodyParams)).rejects.toThrow('some withings error')
  })
})

describe('exchangeWithingsCode and refreshWithingsToken', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exchangeWithingsCode should pass correct params', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 0, body: { nonce: 'n' } }),
    } as Response)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 0, body: { access_token: 'at' } }),
    } as Response)

    await exchangeWithingsCode(
      { clientId: 'cid', clientSecret: 'cs', redirectUri: 'uri' },
      'code123'
    )

    const body = new URLSearchParams(fetchMock.mock.calls[1][1].body)
    expect(body.get('action')).toBe('requesttoken')
    expect(body.get('code')).toBe('code123')
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('redirect_uri')).toBe('uri')
  })

  it('refreshWithingsToken should pass correct params', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 0, body: { nonce: 'n' } }),
    } as Response)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 0, body: { access_token: 'at' } }),
    } as Response)

    await refreshWithingsToken(
      { clientId: 'cid', clientSecret: 'cs' },
      'refresh123'
    )

    const body = new URLSearchParams(fetchMock.mock.calls[1][1].body)
    expect(body.get('action')).toBe('requesttoken')
    expect(body.get('refresh_token')).toBe('refresh123')
    expect(body.get('grant_type')).toBe('refresh_token')
  })
})
