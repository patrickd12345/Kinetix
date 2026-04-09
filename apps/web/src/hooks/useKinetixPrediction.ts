import { useMemo } from 'react'
import { useKinetixIntelligence } from './useKinetixIntelligence'
import { computePrediction } from '../lib/prediction/engine'
import type { KpsSample } from '../lib/intelligence/types'
import type { PredictionResult } from '../lib/prediction/types'
import { useSettingsStore } from '../store/settingsStore'
import type { GoalDistance } from '../lib/goalRace/types'
import type { Distance } from '../lib/calibration/types'

function mapGoalDistance(goalDistance: GoalDistance | null | undefined): Distance {
  if (goalDistance === '5K') return '5k'
  if (goalDistance === '10K') return '10k'
  if (goalDistance === 'Half') return 'half'
  if (goalDistance === 'Marathon') return 'marathon'
  return '10k'
}

export function useKinetixPrediction(): {
  loading: boolean
  error: string | null
  prediction: PredictionResult | null
} {
  const { loading, error, samples } = useKinetixIntelligence()
  const goal = useSettingsStore((s) => s.trainingGoal)
  const distance = mapGoalDistance(goal?.distance)

  const prediction = useMemo(() => {
    if (samples.length === 0) return null
    return computePrediction(samples, distance)
  }, [samples, distance])

  return {
    loading,
    error,
    prediction,
  }
}

export function useKinetixPredictionFromSamples(
  samples: KpsSample[],
  distance: Distance = '10k'
): PredictionResult | null {
  return useMemo(() => {
    if (samples.length === 0) return null
    return computePrediction(samples, distance)
  }, [samples, distance])
}
