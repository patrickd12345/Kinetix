import { describe, expect, it } from 'vitest'
import { computeGoalProgress } from './onTrack'
import type { TrainingGoal } from './types'

const goal: TrainingGoal = {
  distance: 'Half',
  eventDate: '2026-10-12T12:00:00.000Z',
  targetTimeSeconds: 6299,
  priority: 'improve',
}

describe('computeGoalProgress', () => {
  it('computes days remaining and projected race time', () => {
    const result = computeGoalProgress(
      goal,
      [{ date: '2026-04-01T12:00:00.000Z', distance: 10000, duration: 2900, averagePace: 290, targetKPS: 100, locations: [], splits: [] }],
      { direction: 'stable', confidence: 0.8, projectedKps7d: 90, projectedKps28d: 91, message: '' },
      new Date('2026-04-09T00:00:00.000Z')
    )

    expect(result.daysRemaining).toBeGreaterThan(0)
    expect(result.projectedTimeSeconds).not.toBeNull()
    expect(['ahead', 'on_track', 'slightly_behind', 'behind', 'unknown']).toContain(result.status)
  })
})
