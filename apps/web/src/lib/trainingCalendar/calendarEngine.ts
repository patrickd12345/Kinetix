import { buildCalendarDates } from './calendarLayout'
import type { TrainingCalendarInputs, TrainingCalendarResult, TrainingCalendarDay } from './types'

function deriveHorizonDays(inputs: TrainingCalendarInputs): number {
  const plannedDays = inputs.trainingPlan?.week.length ?? 0
  if (plannedDays >= 14) return 14
  return 7
}

function resolveNote(inputs: TrainingCalendarInputs, sessionType: TrainingCalendarDay['sessionType']): string {
  if (inputs.coach?.decision === 'recovery_week' || sessionType === 'recovery') return 'Recovery emphasis'
  if (inputs.periodization.phase === 'taper') return 'Taper support'
  if (sessionType === 'easy' && inputs.loadControl?.riskLevel !== 'low') return 'Load-controlled easy day'
  return 'Build session'
}

export function computeTrainingCalendar(inputs: TrainingCalendarInputs): TrainingCalendarResult {
  const horizonDays = deriveHorizonDays(inputs)
  if (!inputs.trainingPlan) {
    return {
      days: [],
      horizonDays: 7,
    }
  }

  const dates = buildCalendarDates(inputs.now ?? new Date(), horizonDays)
  const byOffset = new Map(inputs.trainingPlan.week.map((session) => [session.dayOffset, session]))
  const days = dates
    .map((dateInfo, index) => {
      const session = byOffset.get(index)
      if (!session) return null
      return {
        date: dateInfo.date,
        label: dateInfo.label,
        sessionType: session.sessionType,
        durationMinutes: session.durationMinutes,
        intensity: session.intensity,
        note: resolveNote(inputs, session.sessionType),
      }
    })
    .filter((value): value is TrainingCalendarDay => value != null)

  return {
    days,
    horizonDays,
  }
}

export const __testables = {
  deriveHorizonDays,
  resolveNote,
}
