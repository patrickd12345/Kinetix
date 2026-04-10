import type { PeriodizationResult } from '../lib/periodization/types'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'

export function useKinetixPeriodization(): {
  loading: boolean
  error: string | null
  periodization: PeriodizationResult
  isGoalDriven: boolean
} {
  const { loading, error, data } = useKinetixCoachingContext()

  return {
    loading,
    error,
    periodization: data.periodization,
    isGoalDriven: data.goal != null,
  }
}
