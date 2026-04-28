import { describe, it, expect, vi } from 'vitest'
import { calculateBestRecentAbsoluteKPSSync, calculateBestRecentRelativeKPSSync } from '../lib/kpsUtils'
import * as kpsUtils from '../lib/kpsUtils'
import * as authState from '../lib/authState'

vi.mock('../lib/database', () => ({
  db: {
    runs: { toArray: vi.fn() },
    pb: { toArray: vi.fn() },
  },
  RUN_VISIBLE: 0,
  getWeightsForDates: vi.fn(),
}))
vi.mock('../lib/authState')

describe('RunDashboard KPS Logic (Refined)', () => {
  it('calculateBestRecentAbsoluteKPSSync picks the highest KPS from meaningful runs', () => {
    const runs = [
      { id: 1, date: '2024-04-25', distance: 5000, duration: 1800 } as any, // 30 min
      { id: 2, date: '2024-04-20', distance: 5000, duration: 1500 } as any, // 25 min (Faster)
      { id: 3, date: '2024-04-15', distance: 10, duration: 5 } as any,    // Junk run
    ]
    const weightMap = new Map()
    const testProfile = { age: 30, weightKg: 70 }

    vi.mocked(authState.resolveProfileForRunWithWeightCache).mockReturnValue(testProfile as any)

    const kps1 = kpsUtils.calculateAbsoluteKPS(runs[0], testProfile as any)
    const kps2 = kpsUtils.calculateAbsoluteKPS(runs[1], testProfile as any)
    // kps3 should be 0 because it's not meaningful (distance < 200m)

    const best = calculateBestRecentAbsoluteKPSSync(runs, weightMap)

    expect(best).toBeGreaterThan(0)
    expect(best).toBe(Math.max(kps1, kps2))
  })

  it('calculateBestRecentRelativeKPSSync correctly scales to PB', () => {
    const runs = [{ id: 1, date: '2024-04-20', distance: 5000, duration: 1500 }] as any
    const weightMap = new Map()
    const testProfile = { age: 30, weightKg: 70 }
    const pb = { profileSnapshot: testProfile }
    const pbRun = { id: 10, distance: 5000, duration: 1200 } as any // PB is even faster

    vi.mocked(authState.resolveProfileForRunWithWeightCache).mockReturnValue(testProfile as any)

    const runAbs = kpsUtils.calculateAbsoluteKPS(runs[0], testProfile as any)
    const pbAbs = kpsUtils.calculateAbsoluteKPS(pbRun, testProfile as any)

    const expectedRelative = (runAbs / pbAbs) * 100

    const relative = calculateBestRecentRelativeKPSSync(runs, weightMap, pb as any, pbRun)
    expect(relative).toBeCloseTo(expectedRelative, 5)
  })
})
