import { describe, expect, it } from 'vitest'
import { computeRaceSimulation } from './raceSimulation'

describe('computeRaceSimulation', () => {
  it('marathon shows progressive fade in pacing', () => {
    const result = computeRaceSimulation({
      distance: 'marathon',
      projectedSeconds: 3 * 3600 + 45 * 60,
      fatigueLevel: 'moderate',
      trend: 0,
      confidence: 0.8,
    })

    const firstPace = result.splits[0].paceSecondsPerKm
    const lastPace = result.splits[result.splits.length - 1].paceSecondsPerKm
    expect(lastPace).toBeGreaterThan(firstPace)
  })

  it('5k remains comparatively stable', () => {
    const result = computeRaceSimulation({
      distance: '5k',
      projectedSeconds: 22 * 60,
      fatigueLevel: 'low',
      trend: 1,
      confidence: 0.9,
    })

    const firstPace = result.splits[0].paceSecondsPerKm
    const lastPace = result.splits[result.splits.length - 1].paceSecondsPerKm
    expect(Math.abs(lastPace - firstPace)).toBeLessThan(12)
  })

  it('higher fatigue increases fade for same distance', () => {
    const lowFatigue = computeRaceSimulation({
      distance: 'half',
      projectedSeconds: 100 * 60,
      fatigueLevel: 'low',
      trend: 0,
      confidence: 0.85,
    })
    const highFatigue = computeRaceSimulation({
      distance: 'half',
      projectedSeconds: 100 * 60,
      fatigueLevel: 'high',
      trend: 0,
      confidence: 0.85,
    })

    const lowDelta =
      lowFatigue.splits[lowFatigue.splits.length - 1].paceSecondsPerKm - lowFatigue.splits[0].paceSecondsPerKm
    const highDelta =
      highFatigue.splits[highFatigue.splits.length - 1].paceSecondsPerKm - highFatigue.splits[0].paceSecondsPerKm

    expect(highDelta).toBeGreaterThan(lowDelta)
  })

  it('clamps unrealistic pacing', () => {
    const result = computeRaceSimulation({
      distance: '5k',
      projectedSeconds: 8 * 60,
      fatigueLevel: 'low',
      trend: 10,
      confidence: 1,
    })

    expect(result.splits.every((split) => split.paceSecondsPerKm >= 120)).toBe(true)
    expect(result.projectedFinishSeconds).toBeGreaterThanOrEqual(8 * 60 * 0.85)
  })
})
