import { useMemo } from 'react'
import { useOptionalKinetixCoachingContextFromProvider } from '../context/KinetixCoachingContextProvider'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'
import { useKinetixCoachExplanation } from './useKinetixCoachExplanation'
import { useKinetixCoachMemory } from './useKinetixCoachMemory'
import { useKinetixRaceReadiness } from './useKinetixRaceReadiness'
import { useKinetixCoachAlerts } from './useKinetixCoachAlerts'
import { computeWeeklyCoachReport } from '../lib/weeklyReport/weeklyReportEngine'
import type { WeeklyCoachReport } from '../lib/weeklyReport/types'

export function useKinetixWeeklyCoachReport(): {
  loading: boolean
  error: string | null
  report: WeeklyCoachReport | null
  insufficientData: boolean
} {
  const provided = useOptionalKinetixCoachingContextFromProvider()
  const { loading, error, data } = provided ?? useKinetixCoachingContext()
  const { explanation } = useKinetixCoachExplanation()
  const { memory } = useKinetixCoachMemory({ persist: false })
  const { readiness } = useKinetixRaceReadiness()
  const { alerts } = useKinetixCoachAlerts()

  const report = useMemo(() => {
    if (!data.coach) return null
    return computeWeeklyCoachReport({
      coach: data.coach,
      explanation,
      readiness,
      alerts,
      loadControl: data.loadControl,
      periodization: data.periodization,
      prediction: data.prediction,
      memory,
    })
  }, [alerts, data, explanation, memory, readiness])

  return {
    loading,
    error,
    report,
    insufficientData: !loading && !error && report == null,
  }
}
