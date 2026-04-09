import type { CoachResult } from '../coach/types'
import { appendSnapshot } from './historyReducer'
import { buildTrendSummary } from './trendSummary'
import type { CoachDecisionSnapshot, CoachMemoryResult } from './types'

function todayIso(now: Date = new Date()): string {
  return now.toISOString()
}

export function buildSnapshot(coach: CoachResult, now: Date = new Date()): CoachDecisionSnapshot {
  return {
    date: todayIso(now),
    decision: coach.decision,
    confidence: coach.confidence,
    reasonSummary: coach.reason,
  }
}

export function updateCoachMemory(
  history: CoachDecisionSnapshot[],
  coach: CoachResult,
  now: Date = new Date()
): CoachMemoryResult {
  const snapshot = buildSnapshot(coach, now)
  const nextHistory = appendSnapshot(history, snapshot)
  return {
    history: nextHistory,
    latest: nextHistory.at(-1) ?? null,
    trendSummary: buildTrendSummary(nextHistory),
  }
}
