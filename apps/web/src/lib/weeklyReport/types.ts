import type { CoachResult } from '../coach/types'
import type { CoachExplanationResult } from '../explainability/types'
import type { RaceReadinessResult } from '../readinessScore/types'
import type { CoachAlertsResult } from '../alerts/types'
import type { LoadControlResult } from '../loadControl/types'
import type { PeriodizationResult } from '../periodization/types'
import type { PredictionResult } from '../prediction/types'
import type { CoachMemoryResult } from '../coachMemory/types'

export interface WeeklyCoachReport {
  title: string
  summary: string
  sections: {
    label: string
    value: string
  }[]
}

export interface WeeklyCoachReportInputs {
  coach: CoachResult | null
  explanation: CoachExplanationResult | null
  readiness: RaceReadinessResult | null
  alerts: CoachAlertsResult
  loadControl: LoadControlResult | null
  periodization: PeriodizationResult
  prediction: PredictionResult | null
  memory: CoachMemoryResult | null
}
