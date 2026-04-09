import type { TrainingPhase } from '../periodization/types'
import type { RiskLevel } from './types'

const MAX_INCREASE = 0.1
const MAX_DECREASE = 0.2

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function phaseModifier(phase: TrainingPhase): number {
  if (phase === 'base') return 0.02
  if (phase === 'build') return 0.03
  if (phase === 'peak') return 0
  return -0.08
}

export function adjustLoad(input: {
  currentWeeklyLoad: number
  riskLevel: RiskLevel
  phase: TrainingPhase
}): { recommendedLoad: number; recommendation: string } {
  const baseMultiplier =
    input.riskLevel === 'high'
      ? 0.82
      : input.riskLevel === 'moderate'
        ? 0.95
        : 1.05

  const adjustedMultiplier = baseMultiplier + phaseModifier(input.phase)
  const boundedMultiplier = clamp(adjustedMultiplier, 1 - MAX_DECREASE, 1 + MAX_INCREASE)
  const recommendedLoad = Math.max(0, input.currentWeeklyLoad * boundedMultiplier)

  const recommendation =
    input.riskLevel === 'high'
      ? 'Reduce weekly load and prioritize recovery to lower injury risk.'
      : input.riskLevel === 'moderate'
        ? 'Hold or slightly reduce load while monitoring fatigue signals.'
        : 'Progress load cautiously while maintaining recovery quality.'

  return {
    recommendedLoad,
    recommendation,
  }
}
