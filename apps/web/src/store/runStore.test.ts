import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { RunRecord } from '../lib/database'

const addMock = vi.hoisted(() => vi.fn())
const transactionMock = vi.hoisted(() => vi.fn())
const checkAndUpdatePBMock = vi.hoisted(() => vi.fn())
const indexRunsAfterSaveMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/database', () => ({
  db: {
    runs: { add: addMock },
    pb: {},
    transaction: transactionMock,
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
    transactionMock.mockReset()
    transactionMock.mockImplementation(async (_mode, _runs, _pb, callback) => callback())
    checkAndUpdatePBMock.mockReset()
    indexRunsAfterSaveMock.mockReset()
  })

  it('commits the run and PB update before dispatching runSaved', async () => {
    addMock.mockResolvedValue(42)
    checkAndUpdatePBMock.mockResolvedValue(false)
    indexRunsAfterSaveMock.mockResolvedValue(undefined)
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    const saved = await persistStoppedRun(runRecord, userProfile)

    expect(saved.id).toBe(42)
    expect(transactionMock).toHaveBeenCalledWith('rw', expect.anything(), expect.anything(), expect.any(Function))
    expect(addMock).toHaveBeenCalledWith(runRecord)
    expect(checkAndUpdatePBMock).toHaveBeenCalledWith({ ...runRecord, id: 42 }, userProfile)
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'kinetix:runSaved' }))
    expect(indexRunsAfterSaveMock).toHaveBeenCalledWith([{ ...runRecord, id: 42 }])
    dispatchSpy.mockRestore()
  })

  it('does not dispatch or index when PB reconciliation fails', async () => {
    addMock.mockResolvedValue(44)
    checkAndUpdatePBMock.mockRejectedValue(new Error('pb failed'))
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    await expect(persistStoppedRun(runRecord, userProfile)).rejects.toThrow('pb failed')

    expect(transactionMock).toHaveBeenCalled()
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'kinetix:runSaved' }))
    expect(indexRunsAfterSaveMock).not.toHaveBeenCalled()
    dispatchSpy.mockRestore()
  })

  it('does not fail the local save when RAG indexing rejects', async () => {
    addMock.mockResolvedValue(43)
    checkAndUpdatePBMock.mockResolvedValue(false)
    indexRunsAfterSaveMock.mockRejectedValue(new Error('rag down'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(persistStoppedRun(runRecord, userProfile)).resolves.toMatchObject({ id: 43 })

    warnSpy.mockRestore()
  })
})
