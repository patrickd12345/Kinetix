import { describe, expect, it } from 'vitest'
import { computeGoalProgress } from './goalAwareModel'

describe('goalAwareModel', () => {
  it('calculates marathon_6h correctly at 20.56 km', () => {
    // At 20.56 km and 3:18:45 elapsed (11925 seconds)
    const currentDistanceKm = 20.56
    const elapsedSec = 11925

    const result = computeGoalProgress('marathon_6h', currentDistanceKm, elapsedSec)

    expect(result.remainingDistanceKm).toBeCloseTo(42.195 - 20.56, 3)

    // 6 hours = 21600 seconds. 21600 - 11925 = 9675 seconds (2:41:15)
    expect(result.remainingTimeSec).toBe(9675)

    // required remaining pace = 9675 / 21.635 ≈ 447.19 sec/km (7:27/km)
    expect(result.requiredRemainingPaceSecPerKm).toBeCloseTo(9675 / 21.635, 2)
  })

  it('calculates half_marathon distance remaining', () => {
    // At 20.56 km
    const currentDistanceKm = 20.56
    const elapsedSec = 0

    const result = computeGoalProgress('half_marathon', currentDistanceKm, elapsedSec)

    expect(result.remainingDistanceKm).toBeCloseTo(21.0975 - 20.56, 4)
    expect(result.remainingTimeSec).toBeUndefined()
  })

  it('returns empty object for free_run', () => {
    expect(computeGoalProgress('free_run', 10, 3600)).toEqual({})
  })
})
