export type PredictionDirection = 'improving' | 'stable' | 'declining' | 'unknown'

export interface PredictionResult {
  direction: PredictionDirection
  confidence: number
  projectedKps7d: number
  projectedKps28d: number
  message: string
}
