import { getCalibration } from '../calibration/calibrationEngine'
import type { Distance } from '../calibration/types'
import type { TrainingGoal } from '../goalRace/types'
import type { FatigueResult } from '../intelligence/types'
import type { PredictionResult } from '../prediction/types'
import { detectTrainingPhase, nextTrainingPhase } from './phaseDetection'
import { computeWeeklyProgression } from './weeklyProgression'
import type { PeriodizationResult } from './types'

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function mapGoalDistance(distance: TrainingGoal['distance'] | null | undefined): Distance {
  if (distance === '5K') return '5k'
  if (distance === '10K') return '10k'
  if (distance === 'Half') return 'half'
  if (distance === 'Marathon') return 'marathon'
  return '10k'
}

function weeksRemainingToEvent(goal: TrainingGoal, now: Date): number {
  const event = startOfUtcDay(new Date(goal.eventDate))
  const today = startOfUtcDay(now)
  const diffMs = Math.max(0, event.getTime() - today.getTime())
  return Math.floor(diffMs / MS_PER_WEEK)
}

export function computePeriodization(input: {
  goal: TrainingGoal | null
  prediction: PredictionResult | null
  fatigue: FatigueResult | null
  now?: Date
}): PeriodizationResult {
  if (!input.goal || !input.prediction || !input.fatigue) {
    return {
      phase: 'base',
      weeksRemaining: 0,
      nextPhase: null,
      focus: 'Set a goal and build more data to unlock adaptive periodization guidance.',
    }
  }

  const now = input.now ?? new Date()
  const weeksRemaining = weeksRemainingToEvent(input.goal, now)
  const phase = detectTrainingPhase(weeksRemaining)
  const nextPhase = nextTrainingPhase(phase)
  const calibration = getCalibration(mapGoalDistance(input.goal.distance))

  const progression = computeWeeklyProgression({
    phase,
    predictionDirection: input.prediction.direction,
    fatigue: input.fatigue,
    calibration,
  })

  return {
    phase,
    weeksRemaining,
    nextPhase,
    focus: progression.focus,
  }
}
