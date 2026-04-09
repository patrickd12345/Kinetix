import type { CoachResult } from '../coach/types'
import type { FatigueResult } from '../intelligence/types'
import type { LoadControlResult } from '../loadControl/types'
import type { PeriodizationResult } from '../periodization/types'
import type { PredictionResult } from '../prediction/types'
import { buildCoachEvidence } from './evidenceBuilder'
import { formatExplanationSummary } from './explanationFormatter'
import type { CoachExplanationResult } from './types'

export function computeCoachExplanation(input: {
  coach: CoachResult
  loadControl: LoadControlResult
  fatigue: FatigueResult
  periodization: PeriodizationResult
  prediction: PredictionResult
}): CoachExplanationResult {
  const evidence = buildCoachEvidence({
    coach: input.coach,
    loadControl: input.loadControl,
    fatigue: input.fatigue,
    periodization: input.periodization,
    prediction: input.prediction,
    weeksRemaining: input.periodization.weeksRemaining,
  })
  const summary = formatExplanationSummary({
    coach: input.coach,
    evidence,
  })

  return {
    decision: input.coach.decision,
    summary,
    evidence,
    confidence: input.coach.confidence,
  }
}
