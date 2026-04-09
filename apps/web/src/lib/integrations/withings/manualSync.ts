export interface ManualSyncGate {
  inFlight: boolean
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
