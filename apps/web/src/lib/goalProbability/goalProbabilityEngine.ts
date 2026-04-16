import type { GoalProbabilityInput, GoalProbabilityResult } from './types'
import {
  buildSummary,
  clampProbability,
  confidenceFromCoverage,
  coverageCount,
  rawGoalProbabilityScore,
  resolveDirection,
} from './probabilityModel'

export function computeGoalProbability(input: GoalProbabilityInput): GoalProbabilityResult | null {
  if (!input.goalProgress) return null

  const probability = clampProbability(
    rawGoalProbabilityScore({
      goalProgress: input.goalProgress,
      prediction: input.prediction,
      readiness: input.readiness,
      simulation: input.simulation,
      timeline: input.timeline,
      memory: input.memory,
    })
  )

  const direction = resolveDirection(input.prediction, input.goalProgress)
  const confidence = confidenceFromCoverage(
    coverageCount({
      prediction: input.prediction,
      readiness: input.readiness,
      simulation: input.simulation,
      timeline: input.timeline,
      memory: input.memory,
    })
  )

  return {
    probability,
    confidence,
    direction,
    summary: buildSummary(probability, direction),
  }
}
