export type GoalDistance = '5K' | '10K' | 'Half' | 'Marathon'
export type GoalPriority = 'finish' | 'improve' | 'PB' | 'peak'

export interface TrainingGoal {
  distance: GoalDistance
  eventDate: string
  targetTimeSeconds?: number
  priority: GoalPriority
}

export type OnTrackStatus = 'ahead' | 'on_track' | 'slightly_behind' | 'behind' | 'unknown'

export interface GoalProgressResult {
  daysRemaining: number
  projectedTimeSeconds: number | null
  targetDeltaSeconds: number | null
  status: OnTrackStatus
  weeklyEmphasis: string
}
