import { describe, expect, it } from 'vitest'
import { __testables } from './useKinetixRaceSimulation'

describe('useKinetixRaceSimulation helpers', () => {
  it('goal distance maps to simulation distance deterministically', () => {
    expect(__testables.mapGoalDistance('5K')).toBe('5k')
    expect(__testables.mapGoalDistance('10K')).toBe('10k')
    expect(__testables.mapGoalDistance('Half')).toBe('half')
    expect(__testables.mapGoalDistance('Marathon')).toBe('marathon')
  })

  it('falls back to explicit distance when no goal exists', () => {
    expect(__testables.mapGoalDistance(null)).toBe(__testables.FALLBACK_DISTANCE)
    expect(__testables.mapGoalDistance(undefined)).toBe(__testables.FALLBACK_DISTANCE)
  })

  it('formats pace and finish time deterministically', () => {
    expect(__testables.formatPace(301)).toBe('5:01/km')
    expect(__testables.formatHhMmSs(3920)).toBe('1:05:20')
  })
})
