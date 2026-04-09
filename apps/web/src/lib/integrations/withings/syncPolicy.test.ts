import { describe, expect, it } from 'vitest'
import { evaluateWithingsSyncPolicy, normalizeSyncTimes } from './syncPolicy'

describe('withings sync policy', () => {
  it('uses default schedule values 08:00 and 20:00 when invalid', () => {
    expect(normalizeSyncTimes(['bad', '25:99'])).toEqual(['08:00', '20:00'])
  })

  it('is not due before first scheduled slot and computes next eligible', () => {
    const decision = evaluateWithingsSyncPolicy({
      now: new Date('2026-04-09T07:30:00'),
      manual: false,
      featureEnabled: true,
      expandedSyncEnabled: true,
      hasConnection: true,
      syncTimes: ['08:00', '20:00'],
      lastSuccessfulScheduledSlotKey: null,
    })
    expect(decision.shouldSync).toBe(false)
    expect(decision.reason).toBe('not_due')
    expect(decision.nextEligibleAt).toContain('2026-04-09T08:00:00')
  })

  it('is due after morning slot until fulfilled', () => {
    const due = evaluateWithingsSyncPolicy({
      now: new Date('2026-04-09T08:01:00'),
      manual: false,
      featureEnabled: true,
      expandedSyncEnabled: true,
      hasConnection: true,
      syncTimes: ['08:00', '20:00'],
      lastSuccessfulScheduledSlotKey: null,
    })
    expect(due.shouldSync).toBe(true)
    expect(due.reason).toBe('scheduled_due')
    expect(due.scheduledSlotKey).toBe('2026-04-09@08:00')

    const notDueAfterFulfilled = evaluateWithingsSyncPolicy({
      now: new Date('2026-04-09T09:00:00'),
      manual: false,
      featureEnabled: true,
      expandedSyncEnabled: true,
      hasConnection: true,
      syncTimes: ['08:00', '20:00'],
      lastSuccessfulScheduledSlotKey: '2026-04-09@08:00',
    })
    expect(notDueAfterFulfilled.shouldSync).toBe(false)
    expect(notDueAfterFulfilled.reason).toBe('not_due')
  })

  it('allows once-per-slot evening run after morning fulfilled', () => {
    const decision = evaluateWithingsSyncPolicy({
      now: new Date('2026-04-09T20:05:00'),
      manual: false,
      featureEnabled: true,
      expandedSyncEnabled: true,
      hasConnection: true,
      syncTimes: ['08:00', '20:00'],
      lastSuccessfulScheduledSlotKey: '2026-04-09@08:00',
    })
    expect(decision.shouldSync).toBe(true)
    expect(decision.scheduledSlotKey).toBe('2026-04-09@20:00')
  })

  it('manual sync bypasses schedule but keeps safety checks', () => {
    const manual = evaluateWithingsSyncPolicy({
      now: new Date('2026-04-09T03:00:00'),
      manual: true,
      featureEnabled: true,
      expandedSyncEnabled: true,
      hasConnection: true,
      syncTimes: ['08:00', '20:00'],
      lastSuccessfulScheduledSlotKey: '2026-04-09@08:00',
    })
    expect(manual.shouldSync).toBe(true)
    expect(manual.reason).toBe('manual')

    const disabled = evaluateWithingsSyncPolicy({
      now: new Date('2026-04-09T03:00:00'),
      manual: true,
      featureEnabled: false,
      expandedSyncEnabled: true,
      hasConnection: true,
      syncTimes: ['08:00', '20:00'],
      lastSuccessfulScheduledSlotKey: null,
    })
    expect(disabled.shouldSync).toBe(false)
    expect(disabled.reason).toBe('flag_disabled')
  })
})
