import { appendSnapshot } from './historyReducer'
import type { CoachDecisionSnapshot } from './types'
import { LEGACY_COACH_MEMORY_KEY, coachMemoryStorageKey } from '../clientStorageScope'

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

export function readCoachMemory(
  authUserId: string,
  storage: Storage = window.localStorage
): CoachDecisionSnapshot[] {
  const scoped = safeParse(storage.getItem(coachMemoryStorageKey(authUserId)))
  if (scoped.length > 0) return scoped
  const legacy = safeParse(storage.getItem(LEGACY_COACH_MEMORY_KEY))
  return legacy
}

export function writeCoachMemory(
  authUserId: string,
  history: CoachDecisionSnapshot[],
  storage: Storage = window.localStorage
): void {
  storage.setItem(coachMemoryStorageKey(authUserId), JSON.stringify(history))
  storage.removeItem(LEGACY_COACH_MEMORY_KEY)
}

export function appendCoachMemory(
  authUserId: string,
  snapshot: CoachDecisionSnapshot,
  storage: Storage = window.localStorage
): CoachDecisionSnapshot[] {
  const current = readCoachMemory(authUserId, storage)
  const next = appendSnapshot(current, snapshot)
  writeCoachMemory(authUserId, next, storage)
  return next
}

export const __constants = {
  LEGACY_COACH_MEMORY_KEY,
  coachMemoryStorageKey,
}
