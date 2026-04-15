import { describe, expect, it } from 'vitest'
import {
  asCanonicalMetrics,
  normalizeActivity,
  normalizeBloodPressure,
  normalizeBodyMeasures,
  normalizeHeartFromMeasures,
  normalizeSleep,
  normalizeWorkouts,
} from './normalize'

describe('withings normalize', () => {
  it('normalizes body and blood pressure measures', () => {
    const groups = [
      {
        grpid: 10,
        date: 1_710_000_000,
        measures: [
          { type: 1, value: 7030, unit: -2 },
          { type: 8, value: 1450, unit: -2 },
          { type: 10, value: 120, unit: 0 },
          { type: 9, value: 80, unit: 0 },
        ],
      },
    ]

    const body = normalizeBodyMeasures('u1', 'sync:1', groups)
    const bp = normalizeBloodPressure('u1', 'sync:1', groups)

    expect(body[0].metric.weightKg).toBe(70.3)
    expect(body[0].metric.fatMassKg).toBe(14.5)
    expect(bp[0].metric.systolicMmHg).toBe(120)
    expect(bp[0].metric.diastolicMmHg).toBe(80)
  })

  it('normalizes activity, sleep, workouts, and heart families', () => {
    const activity = normalizeActivity('u1', 'sync:2', [{ date: '2026-04-01', steps: 9500, distance: 7400, calories: 550 }])
    const sleep = normalizeSleep('u1', 'sync:2', [{ startdate: 1_710_000_000, enddate: 1_710_028_800, deepsleepduration: 3600, lightsleepduration: 10800, remsleepduration: 2400 }])
    const workouts = normalizeWorkouts('u1', 'sync:2', [{ id: 'w1', startdate: 1_710_010_000, enddate: 1_710_012_400, category: 16, distance: 10000, calories: 700 }])
    const heart = normalizeHeartFromMeasures('u1', 'sync:2', [{ date: 1_710_030_000, measures: [{ type: 11, value: 52, unit: 0 }, { type: 135, value: 47, unit: 0 }] }])

    const canonical = asCanonicalMetrics({ activity, sleep, workout: workouts, heart })

    expect(canonical.map((m) => m.family)).toEqual(['sleep', 'activity', 'workout', 'heart'])
    expect(activity[0].metric.steps).toBe(9500)
    expect(sleep[0].metric.sleepEfficiencyPct).toBeGreaterThan(0)
    expect(workouts[0].metric.durationSeconds).toBe(2400)
    expect(heart[0].metric.hrvRmssdMs).toBe(47)
  })

  it('skips records with missing optional values', () => {
    const body = normalizeBodyMeasures('u1', 'sync:3', [{ grpid: 1, date: 1_710_000_000, measures: [{ type: 999, value: 1, unit: 0 }] }])
    const bp = normalizeBloodPressure('u1', 'sync:3', [{ grpid: 2, date: 1_710_000_000, measures: [{ type: 10, value: 120, unit: 0 }] }])
    expect(body).toHaveLength(0)
    expect(bp).toHaveLength(0)
  })
})
