import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WithingsAuthCredentials } from './types'

const dbMocks = vi.hoisted(() => ({
  appendProviderRawEvents: vi.fn(async () => {}),
  appendProviderSyncRun: vi.fn(async () => {}),
  getProviderSyncCheckpoint: vi.fn(async () => ({ lastMeasureUpdate: 100 })),
  putCanonicalHealthMetrics: vi.fn(async () => {}),
  setProviderSyncCheckpoint: vi.fn(async () => {}),
  upsertProviderConnectionState: vi.fn(async () => {}),
}))

const domainMocks = vi.hoisted(() => ({
  syncMeasures: vi.fn(),
  syncActivity: vi.fn(),
  syncWorkouts: vi.fn(),
  syncSleep: vi.fn(),
  syncHeart: vi.fn(),
}))

vi.mock('../../database', () => dbMocks)
vi.mock('./syncMeasures', () => ({ syncMeasures: domainMocks.syncMeasures }))
vi.mock('./syncActivity', () => ({ syncActivity: domainMocks.syncActivity }))
vi.mock('./syncWorkouts', () => ({ syncWorkouts: domainMocks.syncWorkouts }))
vi.mock('./syncSleep', () => ({ syncSleep: domainMocks.syncSleep }))
vi.mock('./syncHeart', () => ({ syncHeart: domainMocks.syncHeart }))

import { syncWithingsData } from './sync'

const creds: WithingsAuthCredentials = {
  accessToken: 'a', refreshToken: 'r', userId: 'u1', expiresAt: Date.now() + 100_000,
}

describe('syncWithingsData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const ok = { rawEvents: [], metrics: [], capabilities: {}, checkpointPatch: {} }
    domainMocks.syncMeasures.mockResolvedValue(ok)
    domainMocks.syncActivity.mockResolvedValue(ok)
    domainMocks.syncWorkouts.mockResolvedValue(ok)
    domainMocks.syncSleep.mockResolvedValue(ok)
    domainMocks.syncHeart.mockResolvedValue(ok)
  })

  it('writes append-only logs and checkpoints and is idempotent on metric ids', async () => {
    domainMocks.syncMeasures.mockResolvedValue({
      rawEvents: [{ id: 'e1', userId: 'u1', family: 'body', createdAt: new Date().toISOString(), payload: {} }],
      metrics: [{ family: 'body', userId: 'u1', source: 'withings', sourceRecordId: 'm1', observedAt: new Date().toISOString(), date: '2026-04-01', metric: { weightKg: 70 }, syncRef: 's1' }],
      capabilities: { body: true },
      checkpointPatch: { lastMeasureUpdate: 111 },
    })

    const first = await syncWithingsData(creds)
    const second = await syncWithingsData(creds)

    expect(first.metricsWritten).toBe(1)
    expect(second.metricsWritten).toBe(1)
    expect(dbMocks.appendProviderSyncRun).toHaveBeenCalledTimes(2)
    expect(dbMocks.putCanonicalHealthMetrics).toHaveBeenCalledTimes(2)
    expect(first.capabilities.body).toBe(true)
  })

  it('handles missing optional streams without failing entire sync', async () => {
    domainMocks.syncSleep.mockResolvedValue({ rawEvents: [], metrics: [], capabilities: {}, errors: ['sleep status 255'] })
    domainMocks.syncActivity.mockRejectedValue(new Error('activity unavailable'))

    const result = await syncWithingsData(creds)

    expect(result.run.status).toBe('failed')
    expect(result.run.errors).toContain('activity unavailable')
    expect(dbMocks.appendProviderSyncRun).toHaveBeenCalledOnce()
  })

  it('detects capabilities from metrics across families', async () => {
    domainMocks.syncMeasures.mockResolvedValue({
      rawEvents: [],
      metrics: [
        { family: 'body', userId: 'u1', source: 'withings', sourceRecordId: 'm1', observedAt: '2026-04-01T00:00:00.000Z', date: '2026-04-01', metric: { weightKg: 70 }, syncRef: 's' },
        { family: 'blood_pressure', userId: 'u1', source: 'withings', sourceRecordId: 'bp1', observedAt: '2026-04-01T00:00:00.000Z', date: '2026-04-01', metric: { systolicMmHg: 120, diastolicMmHg: 80 }, syncRef: 's' },
      ],
      capabilities: {},
      checkpointPatch: {},
    })

    const result = await syncWithingsData(creds)
    expect(result.capabilities.body).toBe(true)
    expect(result.capabilities.bloodPressure).toBe(true)
  })
})
