import type { CoachDecisionSnapshot } from './types'

const HISTORY_CAP = 28

export function dedupeSameDay(history: CoachDecisionSnapshot[]): CoachDecisionSnapshot[] {
  const seenDays = new Set<string>()
  const output: CoachDecisionSnapshot[] = []
  for (const item of [...history].sort((a, b) => b.date.localeCompare(a.date))) {
    const day = item.date.slice(0, 10)
    if (seenDays.has(day)) continue
    seenDays.add(day)
    output.push(item)
  }
  return output.sort((a, b) => a.date.localeCompare(b.date))
}

export function trimHistory(history: CoachDecisionSnapshot[], cap: number = HISTORY_CAP): CoachDecisionSnapshot[] {
  if (history.length <= cap) return [...history]
  return history.slice(history.length - cap)
}

export function appendSnapshot(
  history: CoachDecisionSnapshot[],
  snapshot: CoachDecisionSnapshot
): CoachDecisionSnapshot[] {
  const combined = [...history, snapshot]
  return trimHistory(dedupeSameDay(combined), HISTORY_CAP)
}

export const __constants = {
  HISTORY_CAP,
}
