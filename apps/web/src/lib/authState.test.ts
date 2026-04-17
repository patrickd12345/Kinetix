import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PlatformProfileRecord } from './kinetixProfile'
import * as database from './database'
import { setActivePlatformProfile, getProfileForRun, createGetProfileForRunWithWeightCache } from './authState'
import { useSettingsStore } from '../store/settingsStore'

vi.mock('./database', () => {
  return {
    getWeightAtDate: vi.fn(),
  }
})

const mockProfile: PlatformProfileRecord = {
  id: 'u1',
  age: 40,
  weight_kg: 72,
}

describe('getProfileForRun', () => {
  beforeEach(() => {
    setActivePlatformProfile(mockProfile)
    useSettingsStore.setState({ weightSource: 'profile', lastWithingsWeightKg: 0 })
  })

  afterEach(() => {
    setActivePlatformProfile(null)
    vi.mocked(database.getWeightAtDate).mockReset()
  })

  it('prefers weight history over stale run.weightKg snapshot', async () => {
    vi.mocked(database.getWeightAtDate).mockResolvedValue(68.5)
    const p = await getProfileForRun({ date: '2026-04-03T10:00:00.000Z', weightKg: 72 })
    expect(p.weightKg).toBe(68.5)
  })

  it('falls back to run.weightKg when no history for that date', async () => {
    vi.mocked(database.getWeightAtDate).mockResolvedValue(null)
    const p = await getProfileForRun({ date: '2026-01-01T08:00:00.000Z', weightKg: 71 })
    expect(p.weightKg).toBe(71)
  })
})

describe('createGetProfileForRunWithWeightCache', () => {
  beforeEach(() => {
    setActivePlatformProfile(mockProfile)
    useSettingsStore.setState({ weightSource: 'profile', lastWithingsWeightKg: 0 })
  })

  afterEach(() => {
    setActivePlatformProfile(null)
  })

  it('prefers preloaded map over run.weightKg', async () => {
    const getP = createGetProfileForRunWithWeightCache(new Map([['2026-04-03T12:00:00.000Z', 69]]))
    const p = await getP({ date: '2026-04-03T12:00:00.000Z', weightKg: 72 })
    expect(p.weightKg).toBe(69)
  })
})
