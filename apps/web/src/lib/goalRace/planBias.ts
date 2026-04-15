import type { GoalDistance, GoalProgressResult, TrainingGoal } from './types'

export function distanceBias(distance: GoalDistance): 'speed' | 'balanced' | 'endurance' {
  if (distance === '5K' || distance === '10K') return 'speed'
  if (distance === 'Half') return 'balanced'
  return 'endurance'
}

export function computeWeeklyEmphasis(goal: TrainingGoal, progress: GoalProgressResult): string {
  const phase = progress.weeklyEmphasis
  const bias = distanceBias(goal.distance)

  if (phase === 'taper') return 'Taper and freshness priority'
  if (phase === 'race_specific') {
    if (bias === 'speed') return 'Race-specific speed sharpening'
    if (bias === 'balanced') return 'Balanced race-specific threshold durability'
    return 'Race-specific endurance durability'
  }

  if (bias === 'speed') return 'Base building with speed support'
  if (bias === 'balanced') return 'Base building with balanced speed-endurance support'
  return 'Base building with aerobic volume'
}

export function preferredQualitySession(goal: TrainingGoal, progress: GoalProgressResult): 'tempo' | 'interval' | 'long' {
  if (progress.weeklyEmphasis === 'taper') return 'tempo'
  if (goal.distance === '5K') return 'interval'
  if (goal.distance === '10K') return 'tempo'
  if (goal.distance === 'Half') return 'tempo'
  return 'long'
}
