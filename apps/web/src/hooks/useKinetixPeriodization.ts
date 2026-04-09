import type { PeriodizationResult } from '../lib/periodization/types'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'
import { useOptionalKinetixCoachingContextFromProvider } from '../context/KinetixCoachingContextProvider'

export function useKinetixPeriodization(): {
  loading: boolean
  error: string | null
  periodization: PeriodizationResult
  isGoalDriven: boolean
} {
  const provided = useOptionalKinetixCoachingContextFromProvider()
  const { loading, error, data } = provided ?? useKinetixCoachingContext()

  return {
    loading,
    error,
    periodization: data.periodization,
    isGoalDriven: data.goal != null,
  }
}
