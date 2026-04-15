import type { LoadControlResult } from '../lib/loadControl/types'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'

export function useKinetixLoadControl(): {
  loading: boolean
  error: string | null
  loadControl: LoadControlResult | null
} {
  const { loading, error, data } = useKinetixCoachingContext()

  return {
    loading,
    error,
    loadControl: data.loadControl,
  }
}
