import type { FatigueResult } from '../intelligence/types'
import type { DailyRecommendation, PredictionDirection, RecentActivitySummary, SessionType } from './types'

const HIGH_VOLATILITY_THRESHOLD = 6
const LOW_CONFIDENCE_THRESHOLD = 0.4

const DOWNGRADE_CHAIN: SessionType[] = ['interval', 'tempo', 'long', 'easy', 'recovery', 'rest']

function downgradeSession(sessionType: SessionType): SessionType {
  const index = DOWNGRADE_CHAIN.indexOf(sessionType)
  if (index === -1 || index === DOWNGRADE_CHAIN.length - 1) return sessionType
  return DOWNGRADE_CHAIN[index + 1]
}

function defaults(sessionType: SessionType): Pick<DailyRecommendation, 'durationMinutes' | 'intensity'> {
  if (sessionType === 'rest') return { durationMinutes: null, intensity: null }
  if (sessionType === 'recovery') return { durationMinutes: 25, intensity: 'low' }
  if (sessionType === 'easy') return { durationMinutes: 40, intensity: 'low' }
  if (sessionType === 'tempo') return { durationMinutes: 35, intensity: 'moderate-high' }
  if (sessionType === 'interval') return { durationMinutes: 45, intensity: 'high' }
  return { durationMinutes: 75, intensity: 'moderate' }
}

interface GuardrailInput {
  candidate: DailyRecommendation
  fatigue: FatigueResult
  predictionDirection: PredictionDirection
  activity: RecentActivitySummary
}

export function applyGuardrails({
  candidate,
  fatigue,
  predictionDirection,
  activity,
}: GuardrailInput): DailyRecommendation {
  let sessionType = candidate.sessionType
  const notes: string[] = []

  if (fatigue.level === 'high' && (sessionType === 'interval' || sessionType === 'tempo' || sessionType === 'long')) {
    sessionType = 'recovery'
    notes.push('fatigue high')
  }

  if (predictionDirection === 'declining' && (sessionType === 'interval' || sessionType === 'tempo')) {
    sessionType = downgradeSession(sessionType)
    notes.push('prediction declining')
  }

  if (activity.confidence < LOW_CONFIDENCE_THRESHOLD && (sessionType === 'interval' || sessionType === 'tempo' || sessionType === 'long')) {
    sessionType = downgradeSession(sessionType)
    notes.push('confidence low')
  }

  if (activity.volatility >= HIGH_VOLATILITY_THRESHOLD && (sessionType === 'interval' || sessionType === 'tempo')) {
    sessionType = downgradeSession(sessionType)
    notes.push('volatility high')
  }

  if (sessionType === 'long' && candidate.intensity === 'high') {
    sessionType = 'easy'
    notes.push('long-high pairing blocked')
  }

  const fallback = defaults(sessionType)

  return {
    ...candidate,
    sessionType,
    durationMinutes: fallback.durationMinutes,
    intensity: fallback.intensity,
    rationale: notes.length > 0
      ? `${candidate.rationale} Guardrails applied: ${notes.join(', ')}.`
      : candidate.rationale,
  }
}
