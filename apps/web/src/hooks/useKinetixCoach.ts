import type { CoachResult } from '../lib/coach/types'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'

export function useKinetixCoach(): {
  loading: boolean
  error: string | null
  coach: CoachResult | null
} {
  const { loading, error, data } = useKinetixCoachingContext()

  return {
    loading,
    error,
    coach: data.coach,
  }
}
