import type { FatigueResult, ReadinessResult } from '../intelligence/types'
import type { DailyRecommendation, PredictionDirection, RecentActivitySummary, SessionType } from './types'

const DEFAULT_DURATION: Record<SessionType, number | null> = {
  recovery: 25,
  easy: 40,
  tempo: 35,
  interval: 45,
  long: 75,
  rest: null,
}

const DEFAULT_INTENSITY: Record<SessionType, DailyRecommendation['intensity']> = {
  recovery: 'low',
  easy: 'low',
  tempo: 'moderate-high',
  interval: 'high',
  long: 'moderate',
  rest: null,
}

interface NextSessionInput {
  readiness: ReadinessResult
  fatigue: FatigueResult
  trend: number
  predictionDirection: PredictionDirection
  activity: RecentActivitySummary
}

function recommendationFor(sessionType: SessionType, rationale: string): DailyRecommendation {
  return {
    sessionType,
    durationMinutes: DEFAULT_DURATION[sessionType],
    intensity: DEFAULT_INTENSITY[sessionType],
    rationale,
  }
}

export function selectNextSession(input: NextSessionInput): DailyRecommendation {
  const { readiness, fatigue, trend, predictionDirection, activity } = input

  if (fatigue.level === 'high') {
    if (activity.activeDaysLast7d >= 6) {
      return recommendationFor('rest', 'High fatigue and dense recent activity load suggest full rest today.')
    }
    return recommendationFor('recovery', 'High fatigue detected. Recovery-only day is safest today.')
  }

  if (readiness.status === 'low') {
    return recommendationFor('easy', 'Readiness is low; keep load light with an easy session.')
  }

  if (readiness.status === 'moderate') {
    const trendStable = trend >= -1 && trend <= 2
    if (trendStable && predictionDirection !== 'declining' && activity.qualitySessionsLast7d < 2) {
      return recommendationFor('tempo', 'Moderate readiness with stable trend supports one controlled tempo session.')
    }
    return recommendationFor('easy', 'Moderate readiness with uncertainty favors an easy aerobic day.')
  }

  const improving = trend > 2 && predictionDirection === 'improving'
  const longAlreadyDone = activity.longSessionsLast7d >= 1

  if (improving) {
    if (activity.qualitySessionsLast7d === 0) {
      return recommendationFor('interval', 'High readiness and improving trajectory support a single quality interval session.')
    }
    if (!longAlreadyDone) {
      return recommendationFor('long', 'High readiness remains strong; schedule one controlled long session this week.')
    }
  }

  return recommendationFor('easy', 'High readiness but mixed signals; choose easy load to protect consistency.')
}
