import type { RunRecord } from '../database'
import type { PredictionResult } from '../prediction/types'
import type { GoalDistance, GoalProgressResult, TrainingGoal } from './types'

const DISTANCE_M: Record<GoalDistance, number> = {
  '5K': 5000,
  '10K': 10000,
  Half: 21097.5,
  Marathon: 42195,
}

/**
 * Riegel exponent assumption for deterministic race-time equivalence.
 * 1.06 is a standard endurance scaling constant and intentionally explicit.
 */
const RIEGEL_EXPONENT = 1.06

function projectFromAnchor(anchorDistanceM: number, anchorTimeSec: number, targetDistanceM: number): number {
  if (anchorDistanceM <= 0 || anchorTimeSec <= 0 || targetDistanceM <= 0) return 0
  return anchorTimeSec * (targetDistanceM / anchorDistanceM) ** RIEGEL_EXPONENT
}

function computeProjectedTime(goalDistance: GoalDistance, recentRuns: RunRecord[], prediction: PredictionResult | null): number | null {
  if (recentRuns.length === 0) return null
  const meaningful = recentRuns
    .filter((run) => run.distance > 0 && run.duration > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20)

  if (meaningful.length === 0) return null

  const anchor = meaningful.reduce((best, run) => {
    const bestPace = best.duration / best.distance
    const pace = run.duration / run.distance
    return pace < bestPace ? run : best
  }, meaningful[0])

  const baseProjection = projectFromAnchor(anchor.distance, anchor.duration, DISTANCE_M[goalDistance])
  if (!prediction) return Math.round(baseProjection)

  // Apply small directional adjustment from KPS prediction (bounded to keep deterministic conservative behavior).
  const adjustment = prediction.direction === 'improving' ? -0.015 : prediction.direction === 'declining' ? 0.02 : 0
  return Math.round(baseProjection * (1 + adjustment))
}

function computeStatus(deltaSeconds: number | null): GoalProgressResult['status'] {
  if (deltaSeconds == null) return 'unknown'
  if (deltaSeconds <= -90) return 'ahead'
  if (deltaSeconds <= 45) return 'on_track'
  if (deltaSeconds <= 180) return 'slightly_behind'
  return 'behind'
}

function utcStartOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function computeGoalProgress(
  goal: TrainingGoal,
  recentRuns: RunRecord[],
  prediction: PredictionResult | null,
  now: Date = new Date()
): GoalProgressResult {
  const eventDate = new Date(goal.eventDate)
  const diffMs = utcStartOfDay(eventDate).getTime() - utcStartOfDay(now).getTime()
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))

  const projectedTimeSeconds = computeProjectedTime(goal.distance, recentRuns, prediction)
  const targetDeltaSeconds =
    goal.targetTimeSeconds != null && projectedTimeSeconds != null
      ? projectedTimeSeconds - goal.targetTimeSeconds
      : null

  const status = computeStatus(targetDeltaSeconds)

  const weeklyEmphasis =
    daysRemaining <= 14
      ? 'taper'
      : daysRemaining <= 56
        ? 'race_specific'
        : 'base_building'

  return {
    daysRemaining,
    projectedTimeSeconds,
    targetDeltaSeconds,
    status,
    weeklyEmphasis,
  }
}
