import { useMemo } from 'react'
import { computeCoachExplanation } from '../lib/explainability/explainabilityEngine'
import type { CoachExplanationResult } from '../lib/explainability/types'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'
import { useOptionalKinetixCoachingContextFromProvider } from '../context/KinetixCoachingContextProvider'

export function useKinetixCoachExplanation(): {
  loading: boolean
  error: string | null
  explanation: CoachExplanationResult | null
  insufficientData: boolean
} {
  const provided = useOptionalKinetixCoachingContextFromProvider()
  const { loading, error, data } = provided ?? useKinetixCoachingContext()

  const explanation = useMemo(() => {
    if (!data.coach || !data.intelligence || !data.loadControl || !data.prediction) return null
    return computeCoachExplanation({
      coach: data.coach,
      loadControl: data.loadControl,
      fatigue: data.intelligence.fatigue,
      periodization: data.periodization,
      prediction: data.prediction,
    })
  }, [data])

  return {
    loading,
    error,
    explanation,
    insufficientData: !loading && !error && explanation == null,
  }
}
