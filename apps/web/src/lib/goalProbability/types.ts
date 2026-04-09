import type { PredictionResult } from '../prediction/types'
import type { RaceSimulationResult } from '../simulation/types'
import type { RaceReadinessResult } from '../readinessScore/types'
import type { CoachMemoryResult } from '../coachMemory/types'
import type { GoalProgressResult } from '../goalRace/types'
import type { TimelineEngineResult } from '../timeline/types'

export type GoalProbabilityConfidence = 'low' | 'medium' | 'high'

export type GoalProbabilityDirection = 'improving' | 'stable' | 'declining'

export interface GoalProbabilityResult {
  /** Integer 0–100 inclusive. */
  probability: number
  confidence: GoalProbabilityConfidence
  direction: GoalProbabilityDirection
  /** Single sentence, no line breaks. */
  summary: string
}

export interface GoalProbabilityInput {
  prediction: PredictionResult | null
  readiness: RaceReadinessResult | null
  simulation: RaceSimulationResult | null
  timeline: TimelineEngineResult | null
  goalProgress: GoalProgressResult | null
  memory: CoachMemoryResult | null
}
