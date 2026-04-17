import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { RunRecord } from '../lib/database'

const addMock = vi.hoisted(() => vi.fn())
const updateMock = vi.hoisted(() => vi.fn())
const checkAndUpdatePBMock = vi.hoisted(() => vi.fn())
const indexRunsAfterSaveMock = vi.hoisted(() => vi.fn())

const transactionMock = vi.hoisted(() => vi.fn((mode, tables, tables2, cb) => {
  // Simple mock of Dexie transaction that just executes the callback
  return cb()
}))

vi.mock('../lib/database', () => ({
  db: {
    runs: {
      add: addMock,
      update: updateMock,
    },
    pb: {},
    transaction: transactionMock
  },
}))

vi.mock('../lib/kpsUtils', () => ({
  checkAndUpdatePB: checkAndUpdatePBMock,
}))

vi.mock('../lib/ragClient', () => ({
  indexRunsAfterSave: indexRunsAfterSaveMock,
}))

import { persistStoppedRun } from './runStore'

const runRecord: RunRecord = {
  date: '2026-04-11T12:00:00.000Z',
  distance: 5000,
  duration: 1500,
  averagePace: 300,
  targetKPS: 80,
  locations: [],
  splits: [],
  weightKg: 70,
}

const userProfile = { age: 35, weightKg: 70 }

describe('persistStoppedRun', () => {
  beforeEach(() => {
    addMock.mockReset()
    updateMock.mockReset()
    checkAndUpdatePBMock.mockReset()
    indexRunsAfterSaveMock.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-11T12:30:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('commits the run and PB update before dispatching runSaved', async () => {
    addMock.mockResolvedValue(42)
    updateMock.mockResolvedValue(1)
    checkAndUpdatePBMock.mockResolvedValue(false)
    indexRunsAfterSaveMock.mockResolvedValue(undefined)
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    const saved = await persistStoppedRun(runRecord, userProfile)

    expect(saved.id).toBe(42)
    expect(saved.rag_index_status).toBe('pending')
    expect(addMock).toHaveBeenCalledWith(expect.objectContaining({
      ...runRecord,
      rag_index_status: 'pending',
    }))
    expect(checkAndUpdatePBMock).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }), userProfile)
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'kinetix:runSaved' }))
    expect(indexRunsAfterSaveMock).toHaveBeenCalledWith([expect.objectContaining({ id: 42 })])

    // Await the microtask queue to allow the `.then` on indexing to execute
    await vi.runAllTimersAsync()
    expect(updateMock).toHaveBeenCalledWith(42, expect.objectContaining({ rag_index_status: 'indexed' }))

    dispatchSpy.mockRestore()
  })

  it('does not fail the local save when RAG indexing rejects', async () => {
    addMock.mockResolvedValue(43)
    updateMock.mockResolvedValue(1)
    checkAndUpdatePBMock.mockResolvedValue(false)
    indexRunsAfterSaveMock.mockRejectedValue(new Error('rag down'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(persistStoppedRun(runRecord, userProfile)).resolves.toMatchObject({ id: 43, rag_index_status: 'pending' })

    // Await microtasks
    await vi.runAllTimersAsync()
    expect(updateMock).toHaveBeenCalledWith(43, expect.objectContaining({
      rag_index_status: 'failed',
      rag_index_error: 'rag down'
    }))

    errorSpy.mockRestore()
  })
})
