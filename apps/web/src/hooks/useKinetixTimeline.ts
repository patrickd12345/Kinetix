import { useMemo } from 'react'
import { useOptionalKinetixCoachingContextFromProvider } from '../context/KinetixCoachingContextProvider'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'
import { useKinetixRaceReadiness } from './useKinetixRaceReadiness'
import { useKinetixCoachMemory } from './useKinetixCoachMemory'
import { computeCoachingTimeline } from '../lib/timeline/timelineEngine'
import type { TimelineEngineResult } from '../lib/timeline/types'

export function useKinetixTimeline(): {
  loading: boolean
  error: string | null
  timeline: TimelineEngineResult | null
  insufficientData: boolean
} {
  const provided = useOptionalKinetixCoachingContextFromProvider()
  const { loading, error, data } = provided ?? useKinetixCoachingContext()
  const { readiness } = useKinetixRaceReadiness()
  const { memory } = useKinetixCoachMemory({ persist: false })

  const timeline = useMemo(() => {
    if (!data.intelligence) return null
    return computeCoachingTimeline({
      anchorDate: new Date(),
      prediction: data.prediction,
      readiness,
      simulation: data.raceSimulation,
      trainingPlan: data.trainingPlan,
      periodization: data.periodization,
      loadControl: data.loadControl,
      fatigue: data.intelligence.fatigue,
      intelligence: data.intelligence,
      goalProgress: data.goalProgress,
      memory,
    })
  }, [data, memory, readiness])

  return {
    loading,
    error,
    timeline,
    insufficientData: !loading && !error && timeline == null,
  }
}
