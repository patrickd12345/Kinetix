import type { FatigueResult } from '../intelligence/types'
import type { LoadControlResult } from '../loadControl/types'
import type { PredictionResult } from '../prediction/types'
import type { PeriodizationResult } from '../periodization/types'
import type { GoalProgressResult } from '../goalRace/types'

export type RaceReadinessStatus =
  | 'peak'
  | 'ready'
  | 'building'
  | 'recovery'

export interface RaceReadinessResult {
  score: number
  status: RaceReadinessStatus
  components: {
    fatigue: number
    loadRisk: number
    predictionTrend: number
    phaseAlignment: number
    goalProximity: number
  }
  summary: string
}

export interface RaceReadinessInputs {
  fatigue: FatigueResult | null
  loadControl: LoadControlResult | null
  prediction: PredictionResult | null
  periodization: PeriodizationResult
  goalProgress: GoalProgressResult | null
}
