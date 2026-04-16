export type TrainingPhase =
  | 'base'
  | 'build'
  | 'peak'
  | 'taper'

export interface PeriodizationResult {
  phase: TrainingPhase
  weeksRemaining: number
  nextPhase: TrainingPhase | null
  focus: string
}
