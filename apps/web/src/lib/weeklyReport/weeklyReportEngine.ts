import { buildWeeklyReportSections } from './reportSections'
import type { WeeklyCoachReport, WeeklyCoachReportInputs } from './types'

function buildSummary(inputs: WeeklyCoachReportInputs): string {
  const risk = inputs.loadControl?.riskLevel ?? 'unknown'
  const readiness = inputs.readiness?.status ?? 'building'

  if (risk === 'high' || inputs.coach?.decision === 'recovery_week') {
    return 'This week shifts toward recovery due to elevated fatigue and risk.'
  }

  if (inputs.periodization.phase === 'build' && (readiness === 'ready' || readiness === 'building')) {
    return 'This week remains a controlled build with moderate readiness and low load risk.'
  }

  if (inputs.periodization.phase === 'taper') {
    return 'This week emphasizes taper support with stable readiness and controlled load.'
  }

  return 'This week stays stable with controlled load and steady readiness.'
}

export function computeWeeklyCoachReport(inputs: WeeklyCoachReportInputs): WeeklyCoachReport {
  return {
    title: 'Weekly Coach Report',
    summary: buildSummary(inputs),
    sections: buildWeeklyReportSections(inputs),
  }
}
