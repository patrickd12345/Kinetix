import type { TrainingPlanResult } from '../trainingPlan/types'
import type { PeriodizationResult } from '../periodization/types'
import type { GoalProgressResult } from '../goalRace/types'
import type { CoachResult } from '../coach/types'
import type { LoadControlResult } from '../loadControl/types'

export interface TrainingCalendarDay {
  date: string
  label: string
  sessionType:
    | 'recovery'
    | 'easy'
    | 'tempo'
    | 'interval'
    | 'long'
    | 'rest'
  durationMinutes: number | null
  intensity: 'low' | 'moderate' | 'moderate-high' | 'high' | null
  note: string
}

export interface TrainingCalendarResult {
  days: TrainingCalendarDay[]
  horizonDays: number
}

export interface TrainingCalendarInputs {
  trainingPlan: TrainingPlanResult | null
  periodization: PeriodizationResult
  goalProgress: GoalProgressResult | null
  coach: CoachResult | null
  loadControl: LoadControlResult | null
  now?: Date
}
