import type { CoachAlert, CoachAlertsInputs } from './types'

const PRIORITY_RANK: Record<CoachAlert['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
}

function daysUntilGoal(eventDate: string | null | undefined): number | null {
  if (!eventDate) return null
  const ms = Date.parse(eventDate)
  if (Number.isNaN(ms)) return null
  return Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000))
}

function addUniqueAlert(list: CoachAlert[], next: CoachAlert | null): void {
  if (!next) return
  if (list.some((item) => item.type === next.type)) return
  list.push(next)
}

export function evaluateAlertRules(inputs: CoachAlertsInputs): CoachAlert[] {
  const alerts: CoachAlert[] = []
  const goalDays = daysUntilGoal(inputs.goal?.eventDate)

  // 1) Risk
  addUniqueAlert(
    alerts,
    inputs.loadControl?.riskLevel === 'high'
      ? { type: 'overload_risk', priority: 'high', message: 'Load risk is high. Reduce load now.' }
      : null
  )

  // 2) Fatigue
  addUniqueAlert(
    alerts,
    inputs.intelligence?.fatigue.level === 'high' || inputs.coach?.decision === 'recovery_week'
      ? { type: 'recovery_needed', priority: 'high', message: 'Recovery week is recommended due to fatigue.' }
      : null
  )
  addUniqueAlert(
    alerts,
    inputs.intelligence?.fatigue.level === 'moderate' && inputs.prediction?.direction === 'declining'
      ? { type: 'fatigue_rising', priority: 'medium', message: 'Fatigue is rising. Keep sessions controlled.' }
      : null
  )

  // 3) Taper
  addUniqueAlert(
    alerts,
    inputs.periodization.phase === 'taper' && goalDays != null && goalDays <= 21
      ? { type: 'taper_starting', priority: 'medium', message: 'Taper phase has started. Protect freshness.' }
      : null
  )

  // 4) Readiness
  addUniqueAlert(
    alerts,
    inputs.readiness?.status === 'ready' || inputs.readiness?.status === 'peak'
      ? inputs.prediction?.direction === 'improving' && goalDays != null && goalDays <= 21
        ? { type: 'race_ready', priority: 'medium', message: 'Readiness is strong for the upcoming event.' }
        : null
      : null
  )

  // 5) Progression
  addUniqueAlert(
    alerts,
    inputs.periodization.phase === 'build' && inputs.loadControl?.riskLevel === 'low'
      ? { type: 'build_progression', priority: 'low', message: 'Build progression remains controlled this week.' }
      : null
  )

  return alerts.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
}
