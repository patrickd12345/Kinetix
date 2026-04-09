import { useMemo } from 'react'
import { useOptionalKinetixCoachingContextFromProvider } from '../context/KinetixCoachingContextProvider'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'
import { computeRaceReadiness } from '../lib/readinessScore/readinessScoreEngine'
import type { RaceReadinessResult } from '../lib/readinessScore/types'

export function useKinetixRaceReadiness(): {
  loading: boolean
  error: string | null
  readiness: RaceReadinessResult | null
  insufficientData: boolean
} {
  const provided = useOptionalKinetixCoachingContextFromProvider()
  const { loading, error, data } = provided ?? useKinetixCoachingContext()

  const readiness = useMemo(() => {
    if (!data.intelligence) return null
    return computeRaceReadiness({
      fatigue: data.intelligence.fatigue,
      loadControl: data.loadControl,
      prediction: data.prediction,
      periodization: data.periodization,
      goalProgress: data.goalProgress,
    })
  }, [data])

  return {
    loading,
    error,
    readiness,
    insufficientData: !loading && !error && readiness == null,
  }
}
