import { describe, expect, it } from 'vitest'
import { runManualSyncOnce, shouldMarkScheduledSlotFulfilled } from './manualSync'

describe('runManualSyncOnce', () => {
  it('prevents duplicate sync clicks while in flight', async () => {
    const gate = { inFlight: false }
    let release!: () => void
    const blocker = new Promise<void>((resolve) => { release = resolve })

    const first = runManualSyncOnce(gate, async () => {
      await blocker
      return 1
    })

    const second = await runManualSyncOnce(gate, async () => 2)
    expect(second.started).toBe(false)

    release()
    const firstResult = await first
    expect(firstResult.started).toBe(true)
    expect(firstResult.result).toBe(1)
    expect(gate.inFlight).toBe(false)
  })

  it('marks scheduled slot only when sync succeeded for same due slot', () => {
    expect(
      shouldMarkScheduledSlotFulfilled({
        syncSucceeded: true,
        dueReasonAtSyncStart: 'scheduled_due',
        dueSlotKeyAtSyncStart: '2026-04-09@08:00',
        dueSlotKeyAtSyncEnd: '2026-04-09@08:00',
      })
    ).toBe(true)

    expect(
      shouldMarkScheduledSlotFulfilled({
        syncSucceeded: true,
        dueReasonAtSyncStart: 'not_due',
        dueSlotKeyAtSyncStart: undefined,
        dueSlotKeyAtSyncEnd: undefined,
      })
    ).toBe(false)

    expect(
      shouldMarkScheduledSlotFulfilled({
        syncSucceeded: true,
        dueReasonAtSyncStart: 'scheduled_due',
        dueSlotKeyAtSyncStart: '2026-04-09@08:00',
        dueSlotKeyAtSyncEnd: '2026-04-09@20:00',
      })
    ).toBe(false)
  })
})
