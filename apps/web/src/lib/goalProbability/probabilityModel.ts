import type { GoalProbabilityConfidence, GoalProbabilityDirection } from './types'
import type { PredictionResult } from '../prediction/types'
import type { RaceSimulationResult } from '../simulation/types'
import type { RaceReadinessResult } from '../readinessScore/types'
import type { CoachMemoryResult } from '../coachMemory/types'
import type { GoalProgressResult } from '../goalRace/types'
import type { TimelineEngineResult } from '../timeline/types'

export function clampProbability(value: number): number {
  const n = Math.round(value)
  if (n < 0) return 0
  if (n > 100) return 100
  return n
}

function goalStatusDelta(status: GoalProgressResult['status']): number {
  switch (status) {
    case 'ahead':
      return 20
    case 'on_track':
      return 10
    case 'slightly_behind':
      return -8
    case 'behind':
      return -18
    default:
      return 0
  }
}

function targetDeltaContribution(seconds: number | null | undefined): number {
  if (seconds == null || !Number.isFinite(seconds)) return 0
  // Ahead of target (negative delta): up to +14; behind: up to -14
  const mag = Math.min(14, Math.floor(Math.abs(seconds) / 90))
  return seconds <= 0 ? mag : -mag
}

function predictionDelta(pred: PredictionResult | null): number {
  if (!pred) return 0
  const w = Math.round(14 * pred.confidence)
  switch (pred.direction) {
    case 'improving':
      return w
    case 'declining':
      return -w
    default:
      return 0
  }
}

function readinessDelta(readiness: RaceReadinessResult | null): number {
  if (!readiness) return 0
  return Math.round((readiness.score - 50) / 4)
}

function simulationDelta(sim: RaceSimulationResult | null): number {
  if (!sim) return 0
  switch (sim.fadeRisk) {
    case 'low':
      return 8
    case 'moderate':
      return 0
    case 'high':
      return -12
    default:
      return 0
  }
}

function timelineDelta(timeline: TimelineEngineResult | null): number {
  if (!timeline?.events?.length) return 0
  let d = 0
  for (const e of timeline.events) {
    switch (e.type) {
      case 'peak_window':
      case 'performance_projection':
        d += 4
        break
      case 'taper_window':
        d += 5
        break
      case 'fatigue_risk':
        d -= 10
        break
      case 'readiness_shift':
        d -= 2
        break
      default:
        break
    }
  }
  return Math.max(-18, Math.min(18, d))
}

function memoryDelta(memory: CoachMemoryResult | null): number {
  const dec = memory?.latest?.decision
  if (!dec) return 0
  switch (dec) {
    case 'build_progression':
      return 7
    case 'peak':
      return 5
    case 'taper':
      return 6
    case 'maintain':
      return 2
    case 'recovery_week':
      return -6
    default:
      return 0
  }
}

/** Raw score before clamping; centered around 50. */
export function rawGoalProbabilityScore(input: {
  goalProgress: GoalProgressResult
  prediction: PredictionResult | null
  readiness: RaceReadinessResult | null
  simulation: RaceSimulationResult | null
  timeline: TimelineEngineResult | null
  memory: CoachMemoryResult | null
}): number {
  const gp = input.goalProgress
  let s = 50
  s += goalStatusDelta(gp.status)
  s += targetDeltaContribution(gp.targetDeltaSeconds)
  s += predictionDelta(input.prediction)
  s += readinessDelta(input.readiness)
  s += simulationDelta(input.simulation)
  s += timelineDelta(input.timeline)
  s += memoryDelta(input.memory)
  return s
}

export function coverageCount(input: {
  prediction: PredictionResult | null
  readiness: RaceReadinessResult | null
  simulation: RaceSimulationResult | null
  timeline: TimelineEngineResult | null
  memory: CoachMemoryResult | null
}): number {
  let c = 0
  if (input.prediction) c += 1
  if (input.readiness) c += 1
  if (input.simulation) c += 1
  if (input.timeline?.events?.length) c += 1
  if (input.memory?.latest) c += 1
  return c
}

export function confidenceFromCoverage(c: number): GoalProbabilityConfidence {
  if (c >= 5) return 'high'
  if (c >= 3) return 'medium'
  return 'low'
}

export function resolveDirection(
  prediction: PredictionResult | null,
  goalProgress: GoalProgressResult
): GoalProbabilityDirection {
  if (prediction && prediction.direction !== 'unknown') {
    if (prediction.direction === 'improving') return 'improving'
    if (prediction.direction === 'declining') return 'declining'
    return 'stable'
  }
  if (goalProgress.status === 'ahead') return 'improving'
  if (goalProgress.status === 'behind' || goalProgress.status === 'slightly_behind') return 'declining'
  return 'stable'
}

export function buildSummary(p: number, direction: GoalProbabilityDirection): string {
  const bucket = p >= 67 ? 'high' : p >= 34 ? 'mid' : 'low'
  const key = `${bucket}:${direction}` as const
  const table: Record<string, string> = {
    'high:improving': 'Strong goal odds with improving momentum across current signals.',
    'high:stable': 'Strong goal odds with steady, consistent signals.',
    'high:declining': 'Solid headline odds but trend softening—hold volume and protect recovery.',
    'mid:improving': 'Moderate goal odds with improving signals; consistency will move the needle.',
    'mid:stable': 'Moderate goal odds with mixed but stable signals—stay patient and steady.',
    'mid:declining': 'Moderate goal odds with a cooling trend—prioritize fatigue control and pacing.',
    'low:improving': 'Guarded goal odds despite some upside—small gains still matter.',
    'low:stable': 'Guarded goal odds with flat signals—focus on basics before pushing harder.',
    'low:declining': 'Guarded goal odds with a declining trend—ease load and reassess the plan.',
  }
  return table[key] ?? 'Goal probability reflects current training signals and race outlook.'
}
