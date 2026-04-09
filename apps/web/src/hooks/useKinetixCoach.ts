import type { CoachResult } from '../lib/coach/types'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'
import { useOptionalKinetixCoachingContextFromProvider } from '../context/KinetixCoachingContextProvider'

export function useKinetixCoach(): {
  loading: boolean
  error: string | null
  coach: CoachResult | null
} {
  const provided = useOptionalKinetixCoachingContextFromProvider()
  const { loading, error, data } = provided ?? useKinetixCoachingContext()

  return {
    loading,
    error,
    coach: data.coach,
  }
}
