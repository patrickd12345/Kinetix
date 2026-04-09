import type { FatigueResult } from '../intelligence/types'
import type { PredictionDirection } from '../trainingPlan/types'
import { classifyRampRisk } from './rampRate'
import type { RiskLevel } from './types'

export function detectLoadRisk(input: {
  rampRate: number
  fatigue: FatigueResult
  predictionDirection: PredictionDirection
}): RiskLevel {
  const rampRisk = classifyRampRisk(input.rampRate)

  // Conservative override: high fatigue always yields high load risk.
  if (input.fatigue.level === 'high') return 'high'

  let score = 0
  score += rampRisk === 'high' ? 2 : rampRisk === 'moderate' ? 1 : 0
  score += input.fatigue.level === 'moderate' ? 1 : 0
  score += input.predictionDirection === 'declining' ? 1 : 0
  score -= input.predictionDirection === 'improving' ? 1 : 0

  if (score >= 3) return 'high'
  if (score >= 1) return 'moderate'
  return 'low'
}
