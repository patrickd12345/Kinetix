import { test } from 'node:test'
import { strict as assert } from 'node:assert'

async function loadModuleWithEnv(env) {
  const originalEnv = { ...process.env }
  Object.assign(process.env, env)
  const mod = await import(`./strava-to-googledrive.js?ts=${Date.now()}&rand=${Math.random()}`)
  process.env = originalEnv
  return mod
}

function withMockedFetch(mockImpl, fn) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockImpl
  const run = fn()
  return Promise.resolve(run).finally(() => {
    globalThis.fetch = originalFetch
  })
}

test('getStravaAccessToken returns existing valid token', async () => {
  const { getStravaAccessToken } = await loadModuleWithEnv({
    STRAVA_ACCESS_TOKEN: 'token',
    STRAVA_CLIENT_ID: 'id',
    STRAVA_CLIENT_SECRET: 'secret'
  })

  await withMockedFetch(async () => ({ ok: true, json: async () => ({}) }), async () => {
    const token = await getStravaAccessToken()
    assert.equal(token, 'token')
  })
})

test('refreshStravaToken returns new access token', async () => {
  const { refreshStravaToken } = await loadModuleWithEnv({
    STRAVA_CLIENT_ID: 'id',
    STRAVA_CLIENT_SECRET: 'secret',
    STRAVA_REFRESH_TOKEN: 'refresh'
  })

  await withMockedFetch(async () => ({
    ok: true,
    json: async () => ({ access_token: 'new-token' })
  }), async () => {
    const token = await refreshStravaToken()
    assert.equal(token, 'new-token')
  })
})

test('exchangeGoogleCodeForToken returns tokens', async () => {
  const { exchangeGoogleCodeForToken } = await loadModuleWithEnv({
    GOOGLE_CLIENT_ID: 'gid',
    GOOGLE_CLIENT_SECRET: 'gsecret'
  })

  await withMockedFetch(async () => ({
    ok: true,
    json: async () => ({ access_token: 'g-access', refresh_token: 'g-refresh' })
  }), async () => {
    const tokens = await exchangeGoogleCodeForToken('code')
    assert.equal(tokens.accessToken, 'g-access')
    assert.equal(tokens.refreshToken, 'g-refresh')
  })
})
