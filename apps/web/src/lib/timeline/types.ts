import type { PredictionResult } from '../prediction/types'
import type { RaceSimulationResult } from '../simulation/types'
import type { TrainingPlanResult } from '../trainingPlan/types'
import type { PeriodizationResult } from '../periodization/types'
import type { LoadControlResult } from '../loadControl/types'
import type { RaceReadinessResult } from '../readinessScore/types'
import type { CoachMemoryResult } from '../coachMemory/types'
import type { FatigueResult, IntelligenceResult } from '../intelligence/types'
import type { GoalProgressResult } from '../goalRace/types'

export type TimelineEventType =
  | 'peak_window'
  | 'fatigue_risk'
  | 'performance_projection'
  | 'taper_window'
  | 'readiness_shift'

/** Calendar day offset from anchor (today), inclusive range [7, 28]. */
export interface TimelineEvent {
  type: TimelineEventType
  /** ISO date (YYYY-MM-DD) in local terms; computed from anchor + dayOffset in projection layer. */
  targetDate: string
  dayOffset: number
  title: string
  detail: string
  priority: number
}

export interface TimelineProjection {
  anchorDate: string
  minHorizonDays: number
  maxHorizonDays: number
}

export interface TimelineEngineResult {
  projection: TimelineProjection
  events: TimelineEvent[]
}

/**
 * All inputs optional where upstream data may be missing; the engine only emits events
 * backed by available deterministic signals.
 */
export interface TimelineEngineInput {
  anchorDate: Date
  prediction: PredictionResult | null
  readiness: RaceReadinessResult | null
  simulation: RaceSimulationResult | null
  trainingPlan: TrainingPlanResult | null
  periodization: PeriodizationResult | null
  loadControl: LoadControlResult | null
  fatigue: FatigueResult | null
  intelligence: IntelligenceResult | null
  goalProgress: GoalProgressResult | null
  memory: CoachMemoryResult | null
}
