import { describe, expect, it } from 'vitest'
import { calculateAchievementsSync, getPrimaryAchievement } from './achievements'
import { RunRecord } from './database'

describe('achievements', () => {
  it('identifies KPS PB and Longest distance correctly', () => {
    const prevRun1: RunRecord = { id: 1, distance: 5000, duration: 1500, averagePace: 300, date: '2023-01-01', locations: [], splits: [], targetKPS: 100 }
    const prevRun2: RunRecord = { id: 2, distance: 10000, duration: 3600, averagePace: 360, date: '2023-01-02', locations: [], splits: [], targetKPS: 100 }
    const previousRuns = [prevRun1, prevRun2]

    const prevMap = new Map([
      [1, 95],
      [2, 90]
    ])

    // Target run: longer distance but slower relative KPS.
    const targetRun: RunRecord = { id: 3, distance: 20560, duration: 11925, averagePace: 580, date: '2023-01-03', locations: [], splits: [], targetKPS: 100 }

    // Test 1: Longest distance, but NOT KPS PB
    const achievements1 = calculateAchievementsSync(targetRun, previousRuns, 80, prevMap)
    expect(achievements1).toContain('Longest distance')
    expect(achievements1).not.toContain('KPS PB')
    expect(achievements1).not.toContain('First half marathon') // 20.56 < 21.0975

    // Test 2: Target run is ALSO KPS PB
    const achievements2 = calculateAchievementsSync(targetRun, previousRuns, 96, prevMap)
    expect(achievements2).toContain('Longest distance')
    expect(achievements2).toContain('KPS PB')
  })

  it('identifies First half marathon and First marathon', () => {
    const prevRun1: RunRecord = { id: 1, distance: 15000, duration: 5400, averagePace: 360, date: '2023-01-01', locations: [], splits: [], targetKPS: 100 }
    const previousRuns = [prevRun1]
    const prevMap = new Map([[1, 90]])

    const targetRun: RunRecord = { id: 2, distance: 21100, duration: 7500, averagePace: 355, date: '2023-01-02', locations: [], splits: [], targetKPS: 100 }

    const achievements = calculateAchievementsSync(targetRun, previousRuns, 95, prevMap)
    expect(achievements).toContain('First half marathon')
    expect(achievements).toContain('Longest distance')
    expect(achievements).not.toContain('First marathon')

    expect(getPrimaryAchievement(achievements)).toBe('KPS PB') // It also got KPS PB
  })
})
