import type { IntelligenceResult, KpsSample } from '../lib/intelligence/types'
import type { GoalProgressResult } from '../lib/goalRace/types'
import type { TrainingPlanResult } from '../lib/trainingPlan/types'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'
import { useOptionalKinetixCoachingContextFromProvider } from '../context/KinetixCoachingContextProvider'

export function useKinetixTrainingPlan(): {
  loading: boolean
  error: string | null
  plan: TrainingPlanResult | null
  goalProgress: GoalProgressResult | null
} {
  const provided = useOptionalKinetixCoachingContextFromProvider()
  const { loading, error, data } = provided ?? useKinetixCoachingContext()
  return {
    loading,
    error,
    plan: data.trainingPlan,
    goalProgress: data.goalProgress,
  }
}

export function useKinetixTrainingPlanFromIntelligence(_input: {
  loading: boolean
  error: string | null
  result: IntelligenceResult | null
  samples: KpsSample[]
}): {
  loading: boolean
  error: string | null
  plan: TrainingPlanResult | null
  goalProgress: GoalProgressResult | null
} {
  // Shared coaching context is the single source of truth to avoid drift.
  return useKinetixTrainingPlan()
}
