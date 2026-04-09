import { appendSnapshot } from './historyReducer'
import type { CoachDecisionSnapshot } from './types'

const STORAGE_KEY = 'kinetix-coach-memory-v1'

function safeParse(raw: string | null): CoachDecisionSnapshot[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as CoachDecisionSnapshot[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item.date === 'string' && typeof item.decision === 'string')
      .sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return []
  }
}

export function readCoachMemory(storage: Storage = window.localStorage): CoachDecisionSnapshot[] {
  return safeParse(storage.getItem(STORAGE_KEY))
}

export function writeCoachMemory(history: CoachDecisionSnapshot[], storage: Storage = window.localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(history))
}

export function appendCoachMemory(
  snapshot: CoachDecisionSnapshot,
  storage: Storage = window.localStorage
): CoachDecisionSnapshot[] {
  const current = readCoachMemory(storage)
  const next = appendSnapshot(current, snapshot)
  writeCoachMemory(next, storage)
  return next
}

export const __constants = {
  STORAGE_KEY,
}
