import { useMemo } from 'react'
import { useOptionalKinetixCoachingContextFromProvider } from '../context/KinetixCoachingContextProvider'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'
import { computeTrainingCalendar } from '../lib/trainingCalendar/calendarEngine'
import type { TrainingCalendarResult } from '../lib/trainingCalendar/types'

export function useKinetixTrainingCalendar(): {
  loading: boolean
  error: string | null
  calendar: TrainingCalendarResult | null
  insufficientData: boolean
} {
  const provided = useOptionalKinetixCoachingContextFromProvider()
  const { loading, error, data } = provided ?? useKinetixCoachingContext()

  const calendar = useMemo(() => {
    if (!data.trainingPlan) return null
    return computeTrainingCalendar({
      trainingPlan: data.trainingPlan,
      periodization: data.periodization,
      goalProgress: data.goalProgress,
      coach: data.coach,
      loadControl: data.loadControl,
    })
  }, [data])

  return {
    loading,
    error,
    calendar,
    insufficientData: !loading && !error && calendar == null,
  }
}
