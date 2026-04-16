import type { FatigueResult, ReadinessResult } from '../intelligence/types'
import type { TrainingGoal, GoalProgressResult } from '../goalRace/types'
import type { PredictionResult } from '../prediction/types'
import { preferredQualitySession, computeWeeklyEmphasis, distanceBias } from '../goalRace/planBias'
import { buildMicrocycle } from './microcycle'
import { applyGuardrails } from './guardrails'
import { selectNextSession } from './sessionRules'
import type {
  PredictionDirection,
  RecentActivitySummary,
  TrainingPlanResult,
} from './types'

export interface TrainingPlanInputs {
  readiness: ReadinessResult
  fatigue: FatigueResult
  predictionDirection: PredictionDirection
  prediction: PredictionResult | null
  trend: number
  recentActivity?: Partial<RecentActivitySummary>
  goal?: TrainingGoal | null
  goalProgress?: GoalProgressResult | null
}

/**
 * Conservative fallback profile when upstream data is sparse.
 * Assumption: weak data should reduce aggressiveness and avoid quality overload.
 */
const DEFAULT_RECENT_ACTIVITY: RecentActivitySummary = {
  qualitySessionsLast7d: 0,
  longSessionsLast7d: 0,
  activeDaysLast7d: 0,
  volatility: 0,
  confidence: 0.35,
  hasPb: false,
}

function resolveActivity(input?: Partial<RecentActivitySummary>): RecentActivitySummary {
  return {
    ...DEFAULT_RECENT_ACTIVITY,
    ...input,
  }
}

export function computeTrainingPlan(inputs: TrainingPlanInputs): TrainingPlanResult {
  const activity = resolveActivity(inputs.recentActivity)
  const effectiveConfidence = Math.min(
    activity.confidence,
    inputs.prediction?.confidence ?? activity.confidence
  )
  const guardedActivity = { ...activity, confidence: effectiveConfidence }

  const baseToday = selectNextSession({
    readiness: inputs.readiness,
    fatigue: inputs.fatigue,
    trend: inputs.trend,
    predictionDirection: inputs.predictionDirection,
    activity: guardedActivity,
  })

  const today = applyGuardrails({
    candidate: baseToday,
    fatigue: inputs.fatigue,
    predictionDirection: inputs.predictionDirection,
    activity: guardedActivity,
  })

  // Goal bias assumption: when confidence is sufficient and fatigue is not high,
  // we allow one quality-session preference aligned with the target race demand.
  let biasedToday = today
  if (
    inputs.goal &&
    inputs.goalProgress &&
    guardedActivity.confidence >= 0.55 &&
    inputs.fatigue.level !== 'high'
  ) {
    const preferredQuality = preferredQualitySession(inputs.goal, inputs.goalProgress)
    const goalBias = distanceBias(inputs.goal.distance)
    if (today.sessionType === 'easy' && inputs.readiness.status !== 'low') {
      biasedToday = {
        ...today,
        sessionType: preferredQuality,
        rationale: `${today.rationale} Goal bias applied for ${inputs.goal.distance}: prioritize ${preferredQuality}.`,
      }
    } else if (goalBias === 'speed' && today.sessionType === 'long') {
      biasedToday = {
        ...today,
        sessionType: 'tempo',
        durationMinutes: 35,
        intensity: 'moderate-high',
        rationale: `${today.rationale} Distance calibration favors speed-oriented quality for ${inputs.goal.distance}.`,
      }
    } else if (goalBias === 'endurance' && today.sessionType === 'interval') {
      biasedToday = {
        ...today,
        sessionType: 'long',
        durationMinutes: 75,
        intensity: 'moderate',
        rationale: `${today.rationale} Distance calibration favors endurance-oriented load for ${inputs.goal.distance}.`,
      }
    }
  }

  const week = buildMicrocycle({
    today: biasedToday,
    readiness: inputs.readiness,
    fatigue: inputs.fatigue,
    predictionDirection: inputs.predictionDirection,
    activity: guardedActivity,
  })

  return {
    today: biasedToday,
    week,
    weeklyEmphasis: inputs.goal && inputs.goalProgress
      ? computeWeeklyEmphasis(inputs.goal, inputs.goalProgress)
      : undefined,
  }
}
