import type { WeeklyCoachReportInputs, WeeklyCoachReport } from './types'

function titleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function compactPrediction(value: WeeklyCoachReportInputs['prediction']): string {
  if (!value) return 'Unknown'
  if (value.direction === 'improving') return 'Improving'
  if (value.direction === 'declining') return 'Declining'
  if (value.direction === 'stable') return 'Stable'
  return 'Unknown'
}

function weekFocus(inputs: WeeklyCoachReportInputs): string {
  if (inputs.coach?.decision === 'recovery_week') return 'Recovery load and sleep consistency'
  if (inputs.periodization.phase === 'taper') return 'Taper execution and freshness'
  if (inputs.periodization.phase === 'build') return 'Controlled quality progression'
  return 'Stable aerobic consistency'
}

export function buildWeeklyReportSections(
  inputs: WeeklyCoachReportInputs
): WeeklyCoachReport['sections'] {
  const candidates: WeeklyCoachReport['sections'] = [
    { label: 'Current decision', value: inputs.coach ? titleCase(inputs.coach.decision) : 'Unavailable' },
    { label: 'Why', value: inputs.explanation?.summary ?? 'No explanation available.' },
    {
      label: 'Readiness',
      value: inputs.readiness ? `${inputs.readiness.score}/100 (${titleCase(inputs.readiness.status)})` : 'Unavailable',
    },
    {
      label: 'Load / risk',
      value: inputs.loadControl
        ? `${inputs.loadControl.currentWeeklyLoad.toFixed(1)} km, ${titleCase(inputs.loadControl.riskLevel)} risk`
        : 'Unavailable',
    },
    { label: 'Current phase', value: titleCase(inputs.periodization.phase) },
    { label: 'Prediction direction', value: compactPrediction(inputs.prediction) },
    {
      label: 'Key alert',
      value: inputs.alerts.alerts[0]?.message ?? 'No active alerts.',
    },
    {
      label: 'Recent decision trend',
      value: inputs.memory?.trendSummary ?? 'No trend available.',
    },
    { label: 'This week focus', value: weekFocus(inputs) },
  ]

  return candidates.slice(0, 8)
}
