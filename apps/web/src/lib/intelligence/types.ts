export interface KpsSample {
  date: string
  kps: number
}

export interface ReadinessResult {
  score: number
  status: 'low' | 'moderate' | 'high'
  message: string
}

export interface FatigueResult {
  level: 'low' | 'moderate' | 'high'
  message: string
}

export interface Recommendation {
  type: 'recovery' | 'easy' | 'tempo' | 'interval' | 'long'
  message: string
}

export interface IntelligenceResult {
  readiness: ReadinessResult
  fatigue: FatigueResult
  recommendation: Recommendation
  trend: number
}
