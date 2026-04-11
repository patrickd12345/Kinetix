import type { RunRecord } from '../../lib/database'
import { KPS_SHORT } from '../../lib/branding'
import type { IntelligenceResult } from '../../lib/intelligence/types'

export interface DirectionalHomeSummary {
  loading: boolean
  lastRun: RunRecord | null
  runCount7d: number
  distance7d: number
  streakDays: number
  latestKps: number | null
  intelligence: IntelligenceResult | null
  error: string | null
}

function startOfUtcDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
}

export function computeDirectionalStreakDays(runs: RunRecord[]) {
  const runDays = new Set(runs.map((run) => startOfUtcDay(new Date(run.date))))
  let cursor = startOfUtcDay(new Date())
  let streak = 0
  while (runDays.has(cursor)) {
    streak += 1
    cursor -= 86_400_000
  }
  return streak
}

export function titleCase(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getDirectionalSuggestedTraining(summary: DirectionalHomeSummary) {
  const recommendation = summary.intelligence?.recommendation
  if (recommendation) return `${titleCase(recommendation.type)} to support ${KPS_SHORT}`
  if (!summary.lastRun) return `Start a baseline easy run to establish ${KPS_SHORT}`
  if (summary.intelligence?.fatigue.level === 'high') return `Recovery or rest to protect ${KPS_SHORT}`
  return `Easy 5 km to build ${KPS_SHORT} with control`
}

export function getDirectionalCoachMessage(summary: DirectionalHomeSummary) {
  if (summary.intelligence?.recommendation.message) return summary.intelligence.recommendation.message
  if (!summary.lastRun)
    return `Complete an easy baseline run so Kinetix can calibrate ${KPS_SHORT}, progress, and coaching.`
  return `Keep today controlled while Kinetix builds more ${KPS_SHORT} context from your recent training.`
}
