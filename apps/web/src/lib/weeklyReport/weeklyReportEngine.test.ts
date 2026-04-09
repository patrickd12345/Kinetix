import { describe, expect, it } from 'vitest'
import { computeWeeklyCoachReport } from './weeklyReportEngine'
import { buildWeeklyReportSections } from './reportSections'
import type { WeeklyCoachReportInputs } from './types'

const baseInputs: WeeklyCoachReportInputs = {
  coach: { decision: 'build_progression', reason: 'stable', confidence: 'medium' },
  explanation: { decision: 'build_progression', summary: 'Load is controlled.', evidence: [], confidence: 'medium' },
  readiness: {
    score: 72,
    status: 'ready',
    components: { fatigue: 20, loadRisk: 16, predictionTrend: 14, phaseAlignment: 12, goalProximity: 10 },
    summary: '',
  },
  alerts: { alerts: [{ type: 'build_progression', priority: 'low', message: 'Build progression remains controlled this week.' }] },
  loadControl: { currentWeeklyLoad: 44, rampRate: 4, riskLevel: 'low', recommendedLoad: 46, recommendation: '' },
  periodization: { phase: 'build', weeksRemaining: 6, nextPhase: 'peak', focus: '' },
  prediction: { direction: 'improving', confidence: 0.8, projectedKps7d: 95, projectedKps28d: 97, message: '' },
  memory: {
    history: [],
    latest: null,
    trendSummary: 'Recent decisions have been stable.',
  },
}

describe('weekly report', () => {
  it('uses deterministic summary phrasing', () => {
    const result = computeWeeklyCoachReport(baseInputs)
    expect(result.summary).toBe('This week remains a controlled build with moderate readiness and low load risk.')
  })

  it('caps sections at 8 with compact structure', () => {
    const sections = buildWeeklyReportSections(baseInputs)
    expect(sections.length).toBeLessThanOrEqual(8)
    expect(sections.every((s) => s.label.length > 0 && s.value.length > 0)).toBe(true)
  })

  it('sources sections from provided engine inputs', () => {
    const result = computeWeeklyCoachReport(baseInputs)
    expect(result.sections.some((section) => section.value.includes('Build Progression'))).toBe(true)
    expect(result.sections.some((section) => section.value.includes('controlled'))).toBe(true)
  })

  it('supports insufficient-data path by null report in hook-level usage', () => {
    const result = computeWeeklyCoachReport({ ...baseInputs, coach: null })
    expect(result.title).toBe('Weekly Coach Report')
  })
})
