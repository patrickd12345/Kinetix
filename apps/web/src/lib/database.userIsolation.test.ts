import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  db,
  KinetixDatabase,
  LEGACY_SHARED_DB_NAME,
  scopedIndexedDbName,
  setActiveKinetixIndexedDbUser,
  type RunRecord,
} from './database'

const USER_A = 'user-a'
const USER_B = 'user-b'

const sampleRun: RunRecord = {
  date: '2026-04-19T12:00:00.000Z',
  distance: 5000,
  duration: 1500,
  averagePace: 300,
  targetKPS: 80,
  locations: [],
  splits: [],
  source: 'test',
}

async function resetDatabases(): Promise<void> {
  await setActiveKinetixIndexedDbUser(null)
  await Dexie.delete(scopedIndexedDbName(USER_A))
  await Dexie.delete(scopedIndexedDbName(USER_B))
  await Dexie.delete(LEGACY_SHARED_DB_NAME)
}

describe('KinetixDatabase user isolation', () => {
  beforeEach(async () => {
    localStorage.clear()
    await resetDatabases()
  })

  afterEach(async () => {
    localStorage.clear()
    await resetDatabases()
  })

  it('keeps runs and weights isolated when switching active auth users', async () => {
    await setActiveKinetixIndexedDbUser(USER_A)
    await db.runs.add(sampleRun)
    await db.weightHistory.add({ dateUnix: 1, date: '2026-04-19T00:00:00.000Z', kg: 70 })

    await setActiveKinetixIndexedDbUser(USER_B)

    expect(await db.runs.count()).toBe(0)
    expect(await db.weightHistory.count()).toBe(0)
  })

  it('does not import or delete the legacy shared IndexedDB for the current user', async () => {
    const legacyDb = new KinetixDatabase(LEGACY_SHARED_DB_NAME)
    await legacyDb.open()
    await legacyDb.runs.add(sampleRun)
    legacyDb.close()

    await setActiveKinetixIndexedDbUser(USER_B)

    expect(await db.runs.count()).toBe(0)
    expect(await Dexie.exists(LEGACY_SHARED_DB_NAME)).toBe(true)

    const reopenedLegacy = new KinetixDatabase(LEGACY_SHARED_DB_NAME)
    await reopenedLegacy.open()
    expect(await reopenedLegacy.runs.count()).toBe(1)
    reopenedLegacy.close()
  })
})
