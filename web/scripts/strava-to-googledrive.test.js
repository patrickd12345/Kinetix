import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { convertToRuns } from './strava-to-googledrive.js'

const baseActivity = {
  id: 123,
  start_date: '2024-05-01T10:00:00Z',
  name: 'Morning Run',
  description: 'Nice easy run',
  moving_time: 1500, // 25 minutes
  distance: 5000, // 5 km
  average_heartrate: 150,
  average_cadence: 80,
  total_elevation_gain: 100
}

test('convertToRuns filters non-runs and requires metrics', () => {
  const activities = [
    { ...baseActivity, id: 1, type: 'Ride' },
    { ...baseActivity, id: 2, type: 'Run', distance: 0 },
    { ...baseActivity, id: 3, sport_type: 'Run' }
  ]

  const runs = convertToRuns(activities)
  assert.strictEqual(runs.length, 1)
  assert.strictEqual(runs[0].id, 'strava_3')
})

test('convertToRuns computes pace, NPI, cadence, and heart rate', () => {
  const runs = convertToRuns([{ ...baseActivity, id: 4, type: 'Run' }])

  assert.strictEqual(runs.length, 1)
  const run = runs[0]

  // Distance and duration preserved
  assert.strictEqual(run.distance, 5000)
  assert.strictEqual(run.duration, 1500)

  // Cadence doubled from Strava steps per foot to steps per minute
  assert.strictEqual(run.avgCadence, 160)
  assert.strictEqual(run.avgHeartRate, 150)

  // Pace should be 300s/km (25 min / 5 km)
  assert.strictEqual(run.avgPace, 300)

  // NPI calculation: 12 km/h * distance^0.06 * 10 ~= 132.1
  assert.ok(run.avgNPI > 130 && run.avgNPI < 135)
})

test('convertToRuns leaves cadence null when missing', () => {
  const runs = convertToRuns([{ ...baseActivity, id: 5, type: 'Run', average_cadence: null }])
  assert.strictEqual(runs[0].avgCadence, null)
})
