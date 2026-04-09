import { describe, expect, it } from 'vitest'
import { appendSnapshot, __constants, trimHistory } from './historyReducer'
import { appendCoachMemory, readCoachMemory } from './memoryStore'
import { buildTrendSummary } from './trendSummary'
import type { CoachDecisionSnapshot } from './types'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length(): number { return this.data.size }
  clear(): void { this.data.clear() }
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  key(index: number): string | null { return Array.from(this.data.keys())[index] ?? null }
  removeItem(key: string): void { this.data.delete(key) }
  setItem(key: string, value: string): void { this.data.set(key, value) }
}

function snapshot(date: string, decision: CoachDecisionSnapshot['decision']): CoachDecisionSnapshot {
  return { date, decision, confidence: 'medium', reasonSummary: 'reason' }
}

describe('coach memory', () => {
  it('history append works and same-day dedupe is deterministic', () => {
    const first = snapshot('2026-04-01T10:00:00.000Z', 'build_progression')
    const second = snapshot('2026-04-01T18:00:00.000Z', 'maintain')
    const history = appendSnapshot([first], second)
    expect(history.length).toBe(1)
    expect(history[0].decision).toBe('maintain')
  })

  it('history cap is enforced', () => {
    const input = Array.from({ length: 40 }).map((_, i) =>
      snapshot(`2026-03-${String((i % 28) + 1).padStart(2, '0')}T12:00:00.000Z`, 'maintain')
    )
    const trimmed = trimHistory(input)
    expect(trimmed.length).toBeLessThanOrEqual(__constants.HISTORY_CAP)
  })

  it('trend summary generation is deterministic', () => {
    const summary = buildTrendSummary([
      snapshot('2026-04-01T00:00:00.000Z', 'build_progression'),
      snapshot('2026-04-02T00:00:00.000Z', 'build_progression'),
      snapshot('2026-04-03T00:00:00.000Z', 'maintain'),
      snapshot('2026-04-04T00:00:00.000Z', 'recovery_week'),
    ])
    expect(summary).toContain('Last 4 decisions')
  })

  it('rerender-equivalent duplicate writes on same day are deduped', () => {
    const storage = new MemoryStorage()
    appendCoachMemory(snapshot('2026-04-09T08:00:00.000Z', 'maintain'), storage)
    appendCoachMemory(snapshot('2026-04-09T08:01:00.000Z', 'maintain'), storage)
    expect(readCoachMemory(storage).length).toBe(1)
  })

  it('persistence reload reads previously stored history', () => {
    const storage = new MemoryStorage()
    appendCoachMemory(snapshot('2026-04-09T08:00:00.000Z', 'maintain'), storage)
    const reloaded = readCoachMemory(storage)
    expect(reloaded.length).toBe(1)
    expect(reloaded[0].decision).toBe('maintain')
  })
})
