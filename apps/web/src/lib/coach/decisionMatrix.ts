import type { RiskLevel } from '../loadControl/types'
import type { TrainingPhase } from '../periodization/types'
import type { PredictionDirection } from '../trainingPlan/types'
import type { CoachResult } from './types'

export interface DecisionInputs {
  riskLevel: RiskLevel
  fatigueLevel: 'low' | 'moderate' | 'high'
  phase: TrainingPhase
  predictionDirection: PredictionDirection
  weeksRemaining: number
}

/**
 * Priority order:
 * 1) load risk
 * 2) fatigue
 * 3) phase
 * 4) prediction
 * 5) goal urgency
 */
export function runDecisionMatrix(input: DecisionInputs): CoachResult {
  if (input.riskLevel === 'high') {
    return {
      decision: 'recovery_week',
      reason: 'High load risk overrides other signals to protect recovery and reduce injury risk.',
      confidence: 'high',
    }
  }

  if (input.fatigueLevel === 'high') {
    return {
      decision: 'recovery_week',
      reason: 'High fatigue indicates immediate downshift before progression.',
      confidence: 'high',
    }
  }

  if (input.phase === 'taper' || input.weeksRemaining <= 2) {
    return {
      decision: 'taper',
      reason: 'Goal urgency and phase indicate taper focus and freshness.',
      confidence: 'high',
    }
  }

  if (input.phase === 'peak') {
    return {
      decision: 'peak',
      reason: 'Current phase is peak; maintain race-specific sharpening.',
      confidence: input.predictionDirection === 'declining' ? 'medium' : 'high',
    }
  }

  if (input.phase === 'build' && input.predictionDirection === 'improving' && input.riskLevel === 'low') {
    return {
      decision: 'build_progression',
      reason: 'Build phase with low risk and improving projection supports progression.',
      confidence: 'high',
    }
  }

  if (input.predictionDirection === 'declining' || input.riskLevel === 'moderate' || input.fatigueLevel === 'moderate') {
    return {
      decision: 'maintain',
      reason: 'Mixed signals suggest maintaining load until trends stabilize.',
      confidence: 'medium',
    }
  }

  return {
    decision: 'maintain',
    reason: 'Signals are stable; maintain current structure and consistency.',
    confidence: 'low',
  }
}
