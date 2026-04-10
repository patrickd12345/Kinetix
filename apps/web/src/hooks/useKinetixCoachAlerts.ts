import { useMemo } from 'react'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'
import { computeCoachAlerts } from '../lib/alerts/alertEngine'
import { computeRaceReadiness } from '../lib/readinessScore/readinessScoreEngine'
import type { CoachAlertsResult } from '../lib/alerts/types'

export function useKinetixCoachAlerts(): {
  loading: boolean
  error: string | null
  alerts: CoachAlertsResult
  insufficientData: boolean
} {
  const { loading, error, data } = useKinetixCoachingContext()

  const alerts = useMemo<CoachAlertsResult>(() => {
    const readiness = data.intelligence
      ? computeRaceReadiness({
          fatigue: data.intelligence.fatigue,
          loadControl: data.loadControl,
          prediction: data.prediction,
          periodization: data.periodization,
          goalProgress: data.goalProgress,
        })
      : null

    return computeCoachAlerts({
      coach: data.coach,
      loadControl: data.loadControl,
      prediction: data.prediction,
      intelligence: data.intelligence,
      periodization: data.periodization,
      goal: data.goal,
      readiness,
    })
  }, [data])

  return {
    loading,
    error,
    alerts,
    insufficientData: !loading && !error && alerts.alerts.length === 0,
  }
}
