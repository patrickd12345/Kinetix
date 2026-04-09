import { useEffect, useMemo, useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { useKinetixIntelligence } from './useKinetixIntelligence'
import { getAllVisibleRunsOrdered, type RunRecord } from '../lib/database'
import { useKinetixPredictionFromSamples } from './useKinetixPrediction'
import type { Distance } from '../lib/calibration/types'
import type { GoalDistance } from '../lib/goalRace/types'
import { computeGoalProgress } from '../lib/goalRace/onTrack'
import { computePeriodization } from '../lib/periodization/periodizationEngine'
import { computeLoadControl } from '../lib/loadControl/loadControlEngine'
import { computeCoachDecision } from '../lib/coach/coachEngine'
import { computeTrainingPlan } from '../lib/trainingPlan/trainingPlanEngine'
import { computeRaceSimulation } from '../lib/simulation/raceSimulation'
import type { RecentActivitySummary, TrainingPlanResult } from '../lib/trainingPlan/types'
import type { GoalProgressResult } from '../lib/goalRace/types'
import type { PeriodizationResult } from '../lib/periodization/types'
import type { LoadControlResult } from '../lib/loadControl/types'
import type { CoachResult } from '../lib/coach/types'
import type { RaceSimulationResult } from '../lib/simulation/types'

function mapGoalDistance(goalDistance: GoalDistance | null | undefined): Distance {
  if (goalDistance === '5K') return '5k'
  if (goalDistance === '10K') return '10k'
  if (goalDistance === 'Half') return 'half'
  if (goalDistance === 'Marathon') return 'marathon'
  return '10k'
}

function computeWeeklyLoads(runs: RunRecord[], now: Date = new Date()): number[] {
  const weekLoads = [0, 0, 0, 0]
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000
  const nowMs = now.getTime()
  for (const run of runs) {
    const ageWeeks = Math.floor((nowMs - new Date(run.date).getTime()) / oneWeekMs)
    if (ageWeeks < 0 || ageWeeks > 3) continue
    weekLoads[3 - ageWeeks] += Math.max(0, run.distance / 1000)
  }
  return weekLoads
}

function computeVolatility(values: number[]): number {
  if (values.length <= 1) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function buildRecentSummary(kpsValues: number[]): RecentActivitySummary {
  const recent = kpsValues.slice(-7)
  const volatility = computeVolatility(recent)
  const sizeFactor = Math.min(1, kpsValues.length / 14)
  const stabilityPenalty = Math.min(0.4, volatility / 20)
  const confidence = Math.max(0.3, Math.min(0.95, 0.35 + sizeFactor * 0.6 - stabilityPenalty))
  return {
    qualitySessionsLast7d: recent.filter((value) => value >= 95).length,
    longSessionsLast7d: recent.filter((value) => value >= 92 && value < 98).length > 0 ? 1 : 0,
    activeDaysLast7d: recent.length,
    volatility,
    confidence,
    hasPb: kpsValues.length > 0,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function kpsToPaceSecondsPerKm(projectedKps: number): number {
  return clamp(300 - (projectedKps - 100) * 2.2, 150, 420)
}

const DISTANCE_KM: Record<Distance, number> = {
  '5k': 5,
  '10k': 10,
  half: 21.0975,
  marathon: 42.195,
}

export interface KinetixCoachingContextData {
  goal: ReturnType<typeof useSettingsStore.getState>['trainingGoal']
  goalProgress: GoalProgressResult | null
  intelligence: ReturnType<typeof useKinetixIntelligence>['result']
  prediction: ReturnType<typeof useKinetixPredictionFromSamples>
  periodization: PeriodizationResult
  loadControl: LoadControlResult | null
  coach: CoachResult | null
  trainingPlan: TrainingPlanResult | null
  raceSimulation: RaceSimulationResult | null
  sufficiency: {
    hasIntelligence: boolean
    hasPrediction: boolean
    hasRuns: boolean
    hasCoachInputs: boolean
  }
}

export interface KinetixCoachingContextResult {
  loading: boolean
  error: string | null
  data: KinetixCoachingContextData
}

export function useKinetixCoachingContext(): KinetixCoachingContextResult {
  const goal = useSettingsStore((s) => s.trainingGoal)
  const { loading, error, result, samples } = useKinetixIntelligence()
  const [runs, setRuns] = useState<RunRecord[]>([])
  const prediction = useKinetixPredictionFromSamples(samples, mapGoalDistance(goal?.distance))

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const allRuns = await getAllVisibleRunsOrdered()
      if (!cancelled) setRuns(allRuns)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const data = useMemo<KinetixCoachingContextData>(() => {
    const goalProgress = goal && prediction ? computeGoalProgress(goal, runs, prediction) : null
    const periodization = computePeriodization({
      goal,
      prediction: prediction ?? null,
      fatigue: result?.fatigue ?? null,
    })

    const loadControl =
      result && prediction
        ? computeLoadControl({
            weeklyLoads: computeWeeklyLoads(runs),
            fatigue: result.fatigue,
            predictionDirection: prediction.direction,
            phase: periodization.phase,
          })
        : null

    const coach =
      result && prediction && loadControl
        ? computeCoachDecision({
            loadControl,
            periodization,
            prediction,
            fatigue: result.fatigue,
            goal,
          })
        : null

    const trainingPlan =
      result
        ? computeTrainingPlan({
            readiness: result.readiness,
            fatigue: result.fatigue,
            predictionDirection: prediction?.direction ?? 'unknown',
            prediction: prediction ?? null,
            trend: result.trend,
            recentActivity: buildRecentSummary(samples.map((sample) => sample.kps)),
            goal,
            goalProgress,
          })
        : null

    const raceSimulation =
      result && prediction
        ? computeRaceSimulation({
            distance: mapGoalDistance(goal?.distance),
            projectedSeconds: Math.round(
              kpsToPaceSecondsPerKm(prediction.projectedKps28d) *
                DISTANCE_KM[mapGoalDistance(goal?.distance)]
            ),
            fatigueLevel: result.fatigue.level,
            trend: result.trend,
            confidence: prediction.confidence,
          })
        : null

    return {
      goal,
      goalProgress,
      intelligence: result,
      prediction,
      periodization,
      loadControl,
      coach,
      trainingPlan,
      raceSimulation,
      sufficiency: {
        hasIntelligence: result != null,
        hasPrediction: prediction != null,
        hasRuns: runs.length > 0,
        hasCoachInputs: result != null && prediction != null && loadControl != null,
      },
    }
  }, [goal, prediction, result, runs, samples])

  return {
    loading,
    error,
    data,
  }
}

export const __testables = {
  aggregateLoading: (values: boolean[]): boolean => values.some(Boolean),
  aggregateError: (values: Array<string | null | undefined>): string | null =>
    values.find((value): value is string => Boolean(value)) ?? null,
  buildNullData: (): Pick<KinetixCoachingContextData, 'coach' | 'prediction' | 'loadControl' | 'goalProgress'> => ({
    coach: null,
    prediction: null,
    loadControl: null,
    goalProgress: null,
  }),
}
