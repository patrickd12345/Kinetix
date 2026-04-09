export type RiskLevel =
  | 'low'
  | 'moderate'
  | 'high'

export interface LoadControlResult {
  currentWeeklyLoad: number
  rampRate: number
  riskLevel: RiskLevel
  recommendedLoad: number
  recommendation: string
}
