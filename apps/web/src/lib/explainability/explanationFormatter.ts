import type { CoachResult } from '../coach/types'
import type { CoachEvidenceItem } from './types'

export function formatExplanationSummary(input: {
  coach: CoachResult
  evidence: CoachEvidenceItem[]
}): string {
  const primary = input.evidence[0]
  const decision = input.coach.decision

  if (decision === 'recovery_week') {
    return primary?.key === 'load_risk'
      ? 'Recovery week recommended because load risk is high.'
      : 'Recovery week recommended because fatigue remains elevated.'
  }

  if (decision === 'taper') {
    return 'Taper recommended because goal timing and phase require freshness.'
  }

  if (decision === 'peak') {
    return 'Peak phase maintained for race-specific sharpening.'
  }

  if (decision === 'build_progression') {
    return 'Build progression continues because risk is controlled and trend supports progression.'
  }

  return 'Current plan is maintained because signals are mixed but stable.'
}
