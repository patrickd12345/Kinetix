import type { CoachResult } from '../coach/types'
import type { FatigueResult } from '../intelligence/types'
import type { LoadControlResult } from '../loadControl/types'
import type { PeriodizationResult } from '../periodization/types'
import type { PredictionResult } from '../prediction/types'
import type { CoachEvidenceItem } from './types'

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function primaryKeyForDecision(input: {
  coach: CoachResult
  loadControl: LoadControlResult
  fatigue: FatigueResult
  periodization: PeriodizationResult
}): CoachEvidenceItem['key'] {
  if (input.coach.decision === 'recovery_week') {
    return input.loadControl.riskLevel === 'high' ? 'load_risk' : 'fatigue'
  }
  if (input.coach.decision === 'taper' || input.coach.decision === 'peak') return 'phase'
  return 'phase'
}

export function buildCoachEvidence(input: {
  coach: CoachResult
  loadControl: LoadControlResult
  fatigue: FatigueResult
  periodization: PeriodizationResult
  prediction: PredictionResult
  weeksRemaining: number
}): CoachEvidenceItem[] {
  const evidence: CoachEvidenceItem[] = []
  const primaryKey = primaryKeyForDecision(input)

  const add = (item: CoachEvidenceItem) => {
    if (evidence.some((existing) => existing.key === item.key)) return
    evidence.push(item)
  }

  const loadRiskValue = `${titleCase(input.loadControl.riskLevel)} (${input.loadControl.rampRate.toFixed(1)}% ramp)`
  const fatigueValue = titleCase(input.fatigue.level)
  const phaseValue = titleCase(input.periodization.phase)
  const predictionValue = titleCase(input.prediction.direction)
  const goalUrgencyValue = `${input.weeksRemaining} weeks remaining`

  const byKey: Record<CoachEvidenceItem['key'], CoachEvidenceItem> = {
    load_risk: { key: 'load_risk', label: 'Load risk', value: loadRiskValue, impact: primaryKey === 'load_risk' ? 'primary' : 'secondary' },
    fatigue: { key: 'fatigue', label: 'Fatigue', value: fatigueValue, impact: primaryKey === 'fatigue' ? 'primary' : 'secondary' },
    phase: { key: 'phase', label: 'Phase', value: phaseValue, impact: primaryKey === 'phase' ? 'primary' : 'secondary' },
    prediction: { key: 'prediction', label: 'Prediction', value: predictionValue, impact: primaryKey === 'prediction' ? 'primary' : 'secondary' },
    goal_urgency: { key: 'goal_urgency', label: 'Goal urgency', value: goalUrgencyValue, impact: primaryKey === 'goal_urgency' ? 'primary' : 'secondary' },
    confidence: { key: 'confidence', label: 'Decision confidence', value: titleCase(input.coach.confidence), impact: primaryKey === 'confidence' ? 'primary' : 'secondary' },
  }

  // Always include primary deciding factor first.
  add(byKey[primaryKey])

  // Deterministic inclusion rules.
  if (primaryKey !== 'load_risk') add(byKey.load_risk)
  if (input.fatigue.level !== 'low' || primaryKey === 'fatigue') add(byKey.fatigue)
  if (primaryKey !== 'phase') add(byKey.phase)
  if (input.prediction.direction === 'declining' || input.coach.decision === 'build_progression') add(byKey.prediction)
  if (input.weeksRemaining <= 4 || input.coach.decision === 'taper') add(byKey.goal_urgency)
  add(byKey.confidence)

  return evidence.slice(0, 5)
}
