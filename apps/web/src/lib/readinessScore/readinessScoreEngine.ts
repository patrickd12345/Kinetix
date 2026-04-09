import { computeReadinessComponents } from './scoreComponents'
import type { RaceReadinessInputs, RaceReadinessResult, RaceReadinessStatus } from './types'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function mapStatus(score: number): RaceReadinessStatus {
  if (score >= 90) return 'peak'
  if (score >= 70) return 'ready'
  if (score >= 50) return 'building'
  return 'recovery'
}

function buildSummary(status: RaceReadinessStatus): string {
  if (status === 'peak') return 'Readiness is at peak level for current race conditions.'
  if (status === 'ready') return 'Readiness is stable and race-capable with controlled risk.'
  if (status === 'building') return 'Readiness is building and still needs progression.'
  return 'Readiness is low and recovery should be prioritized.'
}

export function computeRaceReadiness(inputs: RaceReadinessInputs): RaceReadinessResult {
  const components = computeReadinessComponents(inputs)
  const score = clamp(
    components.fatigue +
      components.loadRisk +
      components.predictionTrend +
      components.phaseAlignment +
      components.goalProximity,
    0,
    100
  )
  const status = mapStatus(score)

  return {
    score,
    status,
    components,
    summary: buildSummary(status),
  }
}

export const __testables = {
  mapStatus,
  clamp,
}
