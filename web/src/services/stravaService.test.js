import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { StravaService } from './stravaService.js'

class TestStorage {
  constructor() {
    this.store = new Map()
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null
  }
  setItem(key, value) {
    this.store.set(key, value)
  }
  removeItem(key) {
    this.store.delete(key)
  }
}

test('convertToRuns filters and maps run activities', () => {
  const service = new StravaService({ clientId: 'id', clientSecret: 'secret', storage: new TestStorage() })
  const activities = [
    { id: 1, type: 'Ride', moving_time: 1000, distance: 3000, start_date: '2024-05-01T10:00:00Z' },
    { id: 2, sport_type: 'Run', moving_time: 1800, distance: 6000, average_heartrate: 140, average_cadence: 80, name: 'Long run', description: 'desc', total_elevation_gain: 50, start_date: '2024-05-02T10:00:00Z' }
  ]

  const runs = service.convertToRuns(activities)
  assert.equal(runs.length, 1)

  const run = runs[0]
  assert.equal(run.id, 'strava_2')
  assert.equal(run.duration, 1800)
  assert.equal(run.distance, 6000)
  assert.equal(run.avgCadence, 160)
  assert.equal(run.avgHeartRate, 140)
  assert.ok(run.kps >= 0)
  assert.equal(run.stravaName, 'Long run')
  assert.equal(run.elevationGain, 50)
})

test('getValidAccessToken refreshes when expiring soon', async () => {
  const storage = new TestStorage()
  const service = new StravaService({ clientId: 'id', clientSecret: 'secret', storage, redirectUri: 'http://localhost/callback' })

  storage.setItem('strava_tokens', JSON.stringify({
    accessToken: 'old-token',
    refreshToken: 'refresh-token',
    expiresAt: Date.now() + 60 * 1000 // expires in 1 minute
  }))

  service.refreshAccessToken = async () => ({
    accessToken: 'new-token',
    refreshToken: 'refresh-token',
    expiresAt: Date.now() + 60 * 60 * 1000
  })

  const token = await service.getValidAccessToken()
  assert.equal(token, 'new-token')

  const stored = JSON.parse(storage.getItem('strava_tokens'))
  assert.equal(stored.accessToken, 'new-token')
})

test('getValidAccessToken throws when not authenticated', async () => {
  const service = new StravaService({ clientId: 'id', clientSecret: 'secret', storage: new TestStorage(), redirectUri: 'http://localhost/callback' })
  await assert.rejects(() => service.getValidAccessToken(), /Not authenticated/)
})

test('exchangeCodeForToken returns tokens and athlete', async () => {
  const service = new StravaService({ clientId: 'id', clientSecret: 'secret', storage: new TestStorage(), redirectUri: 'http://localhost/callback' })
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 1000,
      athlete: { id: 42 }
    })
  })

  try {
    const tokens = await service.exchangeCodeForToken('code')
    assert.equal(tokens.accessToken, 'access')
    assert.equal(tokens.refreshToken, 'refresh')
    assert.equal(tokens.athlete.id, 42)
    assert.ok(tokens.expiresAt > Date.now())
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('refreshAccessToken returns new tokens', async () => {
  const service = new StravaService({ clientId: 'id', clientSecret: 'secret', storage: new TestStorage(), redirectUri: 'http://localhost/callback' })
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      access_token: 'refreshed',
      refresh_token: 'refresh-2',
      expires_in: 2000
    })
  })

  try {
    const tokens = await service.refreshAccessToken('refresh')
    assert.equal(tokens.accessToken, 'refreshed')
    assert.equal(tokens.refreshToken, 'refresh-2')
    assert.ok(tokens.expiresAt > Date.now())
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('verifyToken returns false on fetch error', async () => {
  const service = new StravaService({ clientId: 'id', clientSecret: 'secret', storage: new TestStorage(), redirectUri: 'http://localhost/callback' })
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('network') }
  try {
    const ok = await service.verifyToken('token')
    assert.equal(ok, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})
