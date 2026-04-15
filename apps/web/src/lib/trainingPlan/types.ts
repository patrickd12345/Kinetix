export type SessionType =
  | 'recovery'
  | 'easy'
  | 'tempo'
  | 'interval'
  | 'long'
  | 'rest'

export interface DailyRecommendation {
  sessionType: SessionType
  durationMinutes: number | null
  intensity: 'low' | 'moderate' | 'moderate-high' | 'high' | null
  rationale: string
}

export interface PlannedSession {
  dayOffset: number
  label: string
  sessionType: SessionType
  durationMinutes: number | null
  intensity: 'low' | 'moderate' | 'moderate-high' | 'high' | null
}

export interface TrainingPlanResult {
  today: DailyRecommendation
  week: PlannedSession[]
  weeklyEmphasis?: string
}

export type PredictionDirection = 'improving' | 'stable' | 'declining' | 'unknown'

export interface RecentActivitySummary {
  /** Number of quality sessions (tempo/interval/long) completed in the last 7 days. */
  qualitySessionsLast7d: number
  /** Number of long sessions completed in the last 7 days. */
  longSessionsLast7d: number
  /** Number of days with any run activity in last 7 days. */
  activeDaysLast7d: number
  /** Volatility proxy (stddev over recent KPS) used to reduce aggression when unstable. */
  volatility: number
  /** Data confidence from upstream signals, 0.0 to 1.0. */
  confidence: number
  /** Optional PB context for rationale messaging and future expansion. */
  hasPb: boolean
}
