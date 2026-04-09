import type { RaceSplit } from '../lib/simulation/types'
import { useKinetixCoachingContext } from './useKinetixCoachingContext'
import type { Distance } from '../lib/calibration/types'
import type { GoalDistance } from '../lib/goalRace/types'
import { useOptionalKinetixCoachingContextFromProvider } from '../context/KinetixCoachingContextProvider'

const DISTANCE_LABEL: Record<Distance, string> = {
  '5k': '5K',
  '10k': '10K',
  half: 'Half Marathon',
  marathon: 'Marathon',
}
const FALLBACK_DISTANCE: Distance = '10k'

function mapGoalDistance(goalDistance: GoalDistance | null | undefined): Distance {
  if (goalDistance === '5K') return '5k'
  if (goalDistance === '10K') return '10k'
  if (goalDistance === 'Half') return 'half'
  if (goalDistance === 'Marathon') return 'marathon'
  return FALLBACK_DISTANCE
}

function formatHhMmSs(seconds: number | null): string {
  if (seconds == null) return '—'
  const rounded = Math.max(0, Math.round(seconds))
  const h = Math.floor(rounded / 3600)
  const m = Math.floor((rounded % 3600) / 60)
  const s = rounded % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

function formatPace(secondsPerKm: number): string {
  const rounded = Math.max(0, Math.round(secondsPerKm))
  const m = Math.floor(rounded / 60)
  const s = rounded % 60
  return `${m}:${String(s).padStart(2, '0')}/km`
}

export interface RaceSimulationSplitView extends RaceSplit {
  label: string
  paceFormatted: string
  cumulativeSeconds: number
  cumulativeFormatted: string
}

export interface KinetixRaceSimulationViewModel {
  selectedDistance: Distance
  selectedDistanceLabel: string
  isGoalDriven: boolean
  projectedFinishSeconds: number | null
  formattedFinishTime: string
  fadeRisk: 'low' | 'moderate' | 'high' | null
  pacingRecommendation: string | null
  splits: RaceSimulationSplitView[]
  caution: boolean
  confidence: number | null
  confidenceLabel: string
  insufficientData: boolean
}

export function useKinetixRaceSimulation(): {
  loading: boolean
  error: string | null
  simulation: KinetixRaceSimulationViewModel
} {
  const provided = useOptionalKinetixCoachingContextFromProvider()
  const { loading, error, data } = provided ?? useKinetixCoachingContext()
  const selectedDistance = mapGoalDistance(data.goal?.distance)
  const predictionConfidence = data.prediction?.confidence ?? null

  if (!data.raceSimulation || !data.prediction) {
    return {
      loading,
      error,
      simulation: {
        selectedDistance,
        selectedDistanceLabel: DISTANCE_LABEL[selectedDistance],
        isGoalDriven: data.goal != null,
        projectedFinishSeconds: null,
        formattedFinishTime: '—',
        fadeRisk: null,
        pacingRecommendation: null,
        splits: [],
        caution: true,
        confidence: predictionConfidence,
        confidenceLabel: 'Insufficient data',
        insufficientData: true,
      },
    }
  }

  let cumulative = 0
  const splits = data.raceSimulation.splits.map((split) => {
    const segmentDistance = split.segmentEnd - split.segmentStart
    cumulative += split.paceSecondsPerKm * segmentDistance
    return {
      ...split,
      label: `${split.segmentStart.toFixed(1)}-${split.segmentEnd.toFixed(1)} km`,
      paceFormatted: formatPace(split.paceSecondsPerKm),
      cumulativeSeconds: Math.round(cumulative),
      cumulativeFormatted: formatHhMmSs(cumulative),
    }
  })

  const caution = data.prediction.confidence < 0.45
  return {
    loading,
    error,
    simulation: {
      selectedDistance,
      selectedDistanceLabel: DISTANCE_LABEL[selectedDistance],
      isGoalDriven: data.goal != null,
      projectedFinishSeconds: data.raceSimulation.projectedFinishSeconds,
      formattedFinishTime: formatHhMmSs(data.raceSimulation.projectedFinishSeconds),
      fadeRisk: data.raceSimulation.fadeRisk,
      pacingRecommendation: data.raceSimulation.pacingRecommendation,
      splits,
      caution,
      confidence: data.prediction.confidence,
      confidenceLabel: caution ? 'Conservative' : 'Normal',
      insufficientData: false,
    },
  }
}

export const __testables = {
  mapGoalDistance,
  FALLBACK_DISTANCE,
  formatHhMmSs,
  formatPace,
}
