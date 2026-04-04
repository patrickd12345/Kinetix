import { describe, expect, it } from 'vitest'
import { bridgeKinetixRuntimeToUmbrella, shouldBridgeKinetixToUmbrella } from './umbrellaRuntimeBridge'

const emptyBoundary = {
  sessionSummary: 'x',
  decisionsMade: [] as string[],
  newlyActiveWork: [] as string[],
  completedWork: [] as string[],
  current_focus: [] as string[],
  blockers: [] as string[],
  in_progress: [] as string[],
  next_actions: [] as string[],
}

describe('umbrellaRuntimeBridge', () => {
  it('shouldBridgeKinetixToUmbrella is true only when both opt-in and root are set', () => {
    expect(shouldBridgeKinetixToUmbrella({})).toBe(false)
    expect(shouldBridgeKinetixToUmbrella({ KINETIX_UMBRELLA_MEMORY_BRIDGE: '1' })).toBe(false)
    expect(shouldBridgeKinetixToUmbrella({ BOOKIJI_INC_ROOT: '/tmp/bookiji' })).toBe(false)
    expect(
      shouldBridgeKinetixToUmbrella({
        KINETIX_UMBRELLA_MEMORY_BRIDGE: '1',
        BOOKIJI_INC_ROOT: '/tmp/bookiji',
      }),
    ).toBe(true)
  })

  it('bridgeKinetixRuntimeToUmbrella resolves immediately when BOOKIJI_INC_ROOT is unset (no umbrella path)', async () => {
    await expect(
      bridgeKinetixRuntimeToUmbrella({ KINETIX_UMBRELLA_MEMORY_BRIDGE: '1' }, emptyBoundary),
    ).resolves.toBeUndefined()
  })
})
