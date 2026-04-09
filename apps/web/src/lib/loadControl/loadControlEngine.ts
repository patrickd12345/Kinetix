import type { FatigueResult } from '../intelligence/types'
import type { TrainingPhase } from '../periodization/types'
import type { PredictionDirection } from '../trainingPlan/types'
import { adjustLoad } from './loadAdjustment'
import { computeRampRate } from './rampRate'
import { detectLoadRisk } from './riskDetection'
import type { LoadControlResult } from './types'

export function computeLoadControl(input: {
  weeklyLoads: number[]
  fatigue: FatigueResult
  predictionDirection: PredictionDirection
  phase: TrainingPhase
}): LoadControlResult {
  const { currentWeeklyLoad, rampRate } = computeRampRate(input.weeklyLoads)
  const riskLevel = detectLoadRisk({
    rampRate,
    fatigue: input.fatigue,
    predictionDirection: input.predictionDirection,
  })
  const { recommendedLoad, recommendation } = adjustLoad({
    currentWeeklyLoad,
    riskLevel,
    phase: input.phase,
  })

  return {
    currentWeeklyLoad,
    rampRate,
    riskLevel,
    recommendedLoad,
    recommendation,
  }
}
