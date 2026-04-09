import type { CoachResult } from '../coach/types'
import type { LoadControlResult } from '../loadControl/types'
import type { PredictionResult } from '../prediction/types'
import type { IntelligenceResult } from '../intelligence/types'
import type { PeriodizationResult } from '../periodization/types'
import type { TrainingGoal } from '../goalRace/types'
import type { RaceReadinessResult } from '../readinessScore/types'

export type CoachAlertType =
  | 'fatigue_rising'
  | 'overload_risk'
  | 'taper_starting'
  | 'build_progression'
  | 'recovery_needed'
  | 'race_ready'

export type CoachAlertPriority =
  | 'high'
  | 'medium'
  | 'low'

export interface CoachAlert {
  type: CoachAlertType
  priority: CoachAlertPriority
  message: string
}

export interface CoachAlertsResult {
  alerts: CoachAlert[]
}

export interface CoachAlertsInputs {
  coach: CoachResult | null
  loadControl: LoadControlResult | null
  prediction: PredictionResult | null
  intelligence: IntelligenceResult | null
  periodization: PeriodizationResult
  goal: TrainingGoal | null
  readiness: RaceReadinessResult | null
}
