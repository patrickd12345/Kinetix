import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  computeDirectionalStreakDays,
  getDirectionalCoachMessage,
  getDirectionalSuggestedTraining,
  type DirectionalHomeSummary,
} from './run-dashboard/directionalHomeSummary'

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'RunDashboard.tsx'), 'utf8')
const todayCardSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../components/directional/DirectionalTodayCard.tsx'),
  'utf8'
)

function summary(overrides: Partial<DirectionalHomeSummary>): DirectionalHomeSummary {
  return {
    loading: false,
    lastRun: null,
    runCount7d: 0,
    distance7d: 0,
    streakDays: 0,
    referenceKps: null,
    intelligence: null,
    error: null,
    ...overrides,
  }
}

describe('RunDashboard directional KPS UX', () => {
  it('frames empty accounts around establishing KPS context', () => {
    const empty = summary({})

    expect(getDirectionalSuggestedTraining(empty)).toBe('Start a baseline easy run to establish KPS')
    expect(getDirectionalCoachMessage(empty)).toContain('calibrate KPS')
  })

  it('frames normal and high-fatigue guidance through KPS', () => {
    const normal = summary({
      lastRun: {
        id: 1,
        date: new Date().toISOString(),
        distance: 5000,
        duration: 1500,
        averagePace: 300,
        targetKPS: 80,
        locations: [],
        splits: [],
      },
      referenceKps: 88,
      intelligence: {
        readiness: { score: 92, status: 'high', message: 'Ready.' },
        fatigue: { level: 'low', message: 'Low.' },
        recommendation: { type: 'interval', message: 'KPS supports controlled quality today.' },
        trend: 4,
      },
    })
    const highFatigue = summary({
      ...normal,
      intelligence: {
        readiness: { score: 55, status: 'low', message: 'Reduce load.' },
        fatigue: { level: 'high', message: 'High fatigue.' },
        recommendation: { type: 'recovery', message: 'Recovery protects KPS today.' },
        trend: -3,
      },
    })

    expect(getDirectionalSuggestedTraining(normal)).toBe('Interval to support KPS')
    expect(getDirectionalCoachMessage(normal)).toBe('KPS supports controlled quality today.')
    expect(getDirectionalSuggestedTraining(highFatigue)).toBe('Recovery to support KPS')
  })

  it('computes consecutive day streaks from recent runs', () => {
    const today = new Date()
    const yesterday = new Date(Date.now() - 86_400_000)
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000)

    expect(computeDirectionalStreakDays([
      { date: today.toISOString(), distance: 5000, duration: 1500, averagePace: 300, targetKPS: 80, locations: [], splits: [] },
      { date: yesterday.toISOString(), distance: 5000, duration: 1500, averagePace: 300, targetKPS: 80, locations: [], splits: [] },
      { date: twoDaysAgo.toISOString(), distance: 5000, duration: 1500, averagePace: 300, targetKPS: 80, locations: [], splits: [] },
    ])).toBe(3)
  })

  it('keeps KPS as the visual hero and uses referenceKps from the homeSummary', () => {
    expect(source).toContain('<DirectionalTodayCard')
    expect(source).toContain('kps={{ value: heroKpsValue, label: heroKpsLabel }}')
    expect(source).toContain('homeSummary.referenceKps')
    expect(todayCardSource).toContain('aria-label={`${kps.label}: ${kps.value}`}')
    expect(todayCardSource).toContain('text-6xl font-black')
    expect(todayCardSource).toContain('Start Run')
    expect(source).toContain("to: '/history', label: 'History'")
    expect(source).toContain("to: '/coaching', label: 'Coaching'")
    expect(source).toContain("to: '/chat', label: 'Chat'")
    expect(source).toContain("to: '/menu', label: 'Charts'")
  })
})
