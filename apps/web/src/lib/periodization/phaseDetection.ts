import type { TrainingPhase } from './types'

/**
 * Deterministic periodization thresholds (in weeks):
 * - 12+ => base
 * - 6-11 => build
 * - 2-5 => peak
 * - <=1 => taper
 */
export function detectTrainingPhase(weeksRemaining: number): TrainingPhase {
  if (weeksRemaining >= 12) return 'base'
  if (weeksRemaining >= 6) return 'build'
  if (weeksRemaining >= 2) return 'peak'
  return 'taper'
}

export function nextTrainingPhase(phase: TrainingPhase): TrainingPhase | null {
  if (phase === 'base') return 'build'
  if (phase === 'build') return 'peak'
  if (phase === 'peak') return 'taper'
  return null
}
