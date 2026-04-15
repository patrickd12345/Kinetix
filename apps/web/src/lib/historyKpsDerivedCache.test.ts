import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import type { PBRecord } from './database'
import {
  buildHistoryKpsTierKey,
  clearHistoryKpsDerivedCache,
  clearHistoryKpsDerivedStorage,
  hydrateHistoryKpsDerivedFromStorage,
} from './historyKpsDerivedCache'

const tierBase = {
  weightSource: 'profile' as const,
  lastWithingsWeightKg: 0,
  physioMode: false,
  profileAge: 40,
  profileWeightKg: 72,
}

function pbFixture(runId: number): PBRecord {
  return {
    id: 1,
    runId,
    achievedAt: '2026-04-01T10:00:00.000Z',
    profileSnapshot: { age: 40, weightKg: 72 },
  } as PBRecord
}

describe('buildHistoryKpsTierKey', () => {
  it('changes when PB run id changes', () => {
    const a = buildHistoryKpsTierKey({ pb: pbFixture(10), ...tierBase })
    const b = buildHistoryKpsTierKey({ pb: pbFixture(11), ...tierBase })
    expect(a).not.toBe(b)
  })

  it('changes when physioMode toggles', () => {
    const a = buildHistoryKpsTierKey({ pb: pbFixture(1), ...tierBase, physioMode: false })
    const b = buildHistoryKpsTierKey({ pb: pbFixture(1), ...tierBase, physioMode: true })
    expect(a).not.toBe(b)
  })
})

describe('historyKpsDerived localStorage', () => {
  const uid = 'test-user-kps-cache'

  beforeEach(() => {
    clearHistoryKpsDerivedCache()
    clearHistoryKpsDerivedStorage(uid)
    localStorage.removeItem(`kinetix.historyKpsDerived.v1:${uid}`)
  })

  afterEach(() => {
    clearHistoryKpsDerivedCache()
    clearHistoryKpsDerivedStorage(uid)
  })

  it('hydrates only when tierKey matches persisted payload', () => {
    const tierKey = 'tier-a'
    localStorage.setItem(
      `kinetix.historyKpsDerived.v1:${uid}`,
      JSON.stringify({ v: 1, tierKey, entries: [[1, 95, 'sig:v1']] }),
    )
    expect(hydrateHistoryKpsDerivedFromStorage(uid, tierKey)).toBe(true)
    expect(hydrateHistoryKpsDerivedFromStorage(uid, 'other-tier')).toBe(false)
  })
})
