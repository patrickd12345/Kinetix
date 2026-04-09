import type { CoachDecisionSnapshot } from './types'

function shortDecision(value: CoachDecisionSnapshot['decision']): string {
  if (value === 'build_progression') return 'Build'
  if (value === 'recovery_week') return 'Recovery'
  if (value === 'maintain') return 'Maintain'
  if (value === 'peak') return 'Peak'
  return 'Taper'
}

export function buildTrendSummary(history: CoachDecisionSnapshot[]): string {
  if (history.length === 0) return 'No history yet'
  const recent = history.slice(-4)
  const chain = recent.map((item) => shortDecision(item.decision)).join(' → ')
  if (recent.length >= 3 && new Set(recent.map((item) => item.decision)).size <= 2) {
    return `Last ${recent.length} decisions: ${chain}. Recent coaching trend stabilizing.`
  }
  return `Last ${recent.length} decisions: ${chain}`
}
