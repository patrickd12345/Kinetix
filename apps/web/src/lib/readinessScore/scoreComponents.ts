import type { RaceReadinessInputs, RaceReadinessResult } from './types'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function scoreFatigue(inputs: RaceReadinessInputs): number {
  const level = inputs.fatigue?.level
  if (level === 'high') return 4
  if (level === 'moderate') return 14
  if (level === 'low') return 26
  return 12
}

function scoreLoadRisk(inputs: RaceReadinessInputs): number {
  const risk = inputs.loadControl?.riskLevel
  if (risk === 'high') return 3
  if (risk === 'moderate') return 10
  if (risk === 'low') return 18
  return 8
}

function scorePredictionTrend(inputs: RaceReadinessInputs): number {
  const direction = inputs.prediction?.direction
  if (direction === 'improving') return 18
  if (direction === 'stable') return 11
  if (direction === 'declining') return 4
  return 8
}

function scorePhaseAlignment(inputs: RaceReadinessInputs): number {
  const daysRemaining = inputs.goalProgress?.daysRemaining
  const phase = inputs.periodization.phase
  if (daysRemaining == null) {
    if (phase === 'build') return 10
    if (phase === 'base') return 8
    if (phase === 'peak') return 11
    if (phase === 'taper') return 9
  }

  if (daysRemaining != null && daysRemaining <= 21 && (phase === 'taper' || phase === 'peak')) return 14
  if (daysRemaining != null && daysRemaining <= 42 && phase === 'build') return 10
  if (phase === 'base') return 7
  return 9
}

function scoreGoalProximity(inputs: RaceReadinessInputs, baseWithoutGoal: number): number {
  const daysRemaining = inputs.goalProgress?.daysRemaining
  if (daysRemaining == null) return 7
  if (daysRemaining > 56) return 7
  if (daysRemaining > 21) return 10

  // Near event, avoid inflation if current readiness basis is weak.
  if (baseWithoutGoal < 55) return 2
  if (baseWithoutGoal < 70) return 6
  return 12
}

export function computeReadinessComponents(
  inputs: RaceReadinessInputs
): RaceReadinessResult['components'] {
  const fatigue = clamp(scoreFatigue(inputs), 0, 30)
  const loadRisk = clamp(scoreLoadRisk(inputs), 0, 20)
  const predictionTrend = clamp(scorePredictionTrend(inputs), 0, 20)
  const phaseAlignment = clamp(scorePhaseAlignment(inputs), 0, 15)
  const baseWithoutGoal = fatigue + loadRisk + predictionTrend + phaseAlignment
  const goalProximity = clamp(scoreGoalProximity(inputs, baseWithoutGoal), 0, 15)

  return {
    fatigue,
    loadRisk,
    predictionTrend,
    phaseAlignment,
    goalProximity,
  }
}

export const __testables = {
  clamp,
}
