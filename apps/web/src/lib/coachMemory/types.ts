export interface CoachDecisionSnapshot {
  date: string
  decision:
    | 'recovery_week'
    | 'build_progression'
    | 'maintain'
    | 'peak'
    | 'taper'
  confidence: 'low' | 'medium' | 'high'
  reasonSummary: string
}

export interface CoachMemoryResult {
  history: CoachDecisionSnapshot[]
  latest: CoachDecisionSnapshot | null
  trendSummary: string
}
