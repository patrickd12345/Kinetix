import type { LoadControlResult } from '../lib/loadControl/types'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'
import { useOptionalKinetixCoachingContextFromProvider } from '../context/KinetixCoachingContextProvider'

export function useKinetixLoadControl(): {
  loading: boolean
  error: string | null
  loadControl: LoadControlResult | null
} {
  const provided = useOptionalKinetixCoachingContextFromProvider()
  const { loading, error, data } = provided ?? useKinetixCoachingContext()

  return {
    loading,
    error,
    loadControl: data.loadControl,
  }
}
