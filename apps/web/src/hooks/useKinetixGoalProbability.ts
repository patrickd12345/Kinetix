import { useMemo } from 'react'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'
import { useKinetixRaceReadiness } from './useKinetixRaceReadiness'
import { useKinetixCoachMemory } from './useKinetixCoachMemory'
import { computeCoachingTimeline } from '../lib/timeline/timelineEngine'
import { computeGoalProbability } from '../lib/goalProbability/goalProbabilityEngine'
import type { GoalProbabilityResult } from '../lib/goalProbability/types'
import type { TimelineEngineResult } from '../lib/timeline/types'

export function useKinetixGoalProbability(options?: {
  /** When set (e.g. from `useKinetixTimeline()`), avoids recomputing the coaching timeline. */
  timeline?: TimelineEngineResult | null
}): {
  loading: boolean
  error: string | null
  goalProbability: GoalProbabilityResult | null
  insufficientData: boolean
} {
  const { loading, error, data } = useKinetixCoachingContext()
  const { readiness } = useKinetixRaceReadiness()
  const { memory } = useKinetixCoachMemory({ persist: false })

  const timeline = useMemo((): TimelineEngineResult | null => {
    if (options?.timeline !== undefined) return options.timeline
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
  }, [data, memory, options?.timeline, readiness])

  const goalProbability = useMemo(() => {
    if (!data.goalProgress) return null
    return computeGoalProbability({
      prediction: data.prediction,
      readiness,
      simulation: data.raceSimulation,
      timeline,
      goalProgress: data.goalProgress,
      memory,
    })
  }, [data.goalProgress, data.prediction, data.raceSimulation, memory, readiness, timeline])

  return {
    loading,
    error,
    goalProbability,
    insufficientData: !loading && !error && goalProbability == null,
  }
}
