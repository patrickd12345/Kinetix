import type { WithingsSyncReason } from './syncPolicy'

export interface ManualSyncGate {
  inFlight: boolean
}

export interface ScheduledSlotFulfillmentInput {
  syncSucceeded: boolean
  dueReasonAtSyncStart: WithingsSyncReason
  dueSlotKeyAtSyncStart?: string
  dueSlotKeyAtSyncEnd?: string
}

export function shouldMarkScheduledSlotFulfilled(input: ScheduledSlotFulfillmentInput): boolean {
  if (!input.syncSucceeded) return false
  if (input.dueReasonAtSyncStart !== 'scheduled_due') return false
  if (!input.dueSlotKeyAtSyncStart || !input.dueSlotKeyAtSyncEnd) return false
  return input.dueSlotKeyAtSyncStart === input.dueSlotKeyAtSyncEnd
}

export async function runManualSyncOnce<T>(gate: ManualSyncGate, run: () => Promise<T>): Promise<{ started: boolean; result?: T }> {
  if (gate.inFlight) return { started: false }
  gate.inFlight = true
  try {
    const result = await run()
    return { started: true, result }
  } finally {
    gate.inFlight = false
  }
}
