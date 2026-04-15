export type CoachDecision =
  | 'recovery_week'
  | 'build_progression'
  | 'maintain'
  | 'peak'
  | 'taper'

export interface CoachResult {
  decision: CoachDecision
  reason: string
  confidence: 'low' | 'medium' | 'high'
}
