import type { TrainingGoal } from '../goalRace/types'
import type { FatigueResult } from '../intelligence/types'
import type { LoadControlResult } from '../loadControl/types'
import type { PeriodizationResult } from '../periodization/types'
import type { PredictionResult } from '../prediction/types'
import { runDecisionMatrix } from './decisionMatrix'
import type { CoachResult } from './types'

export function computeCoachDecision(input: {
  loadControl: LoadControlResult
  periodization: PeriodizationResult
  prediction: PredictionResult
  fatigue: FatigueResult
  goal: TrainingGoal | null
}): CoachResult {
  const weeksRemaining = input.goal ? input.periodization.weeksRemaining : 999

  return runDecisionMatrix({
    riskLevel: input.loadControl.riskLevel,
    fatigueLevel: input.fatigue.level,
    phase: input.periodization.phase,
    predictionDirection: input.prediction.direction,
    weeksRemaining,
  })
}
