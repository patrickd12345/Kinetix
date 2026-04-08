import { describe, expect, it } from 'vitest'
import {
  hybridHelpEscalationGateMet,
  isHelpSupportSearchCycleUnresolved,
  shouldProposeHelpEscalation,
} from './helpCenterFallback'
import type { HelpSupportAiOutcome } from './helpCenterSupportAi'
import type { SupportKBQueryOutcome } from './supportRagClient'

const strongKb: SupportKBQueryOutcome = {
  ok: true,
  data: {
    collection: 'kinetix_support_kb',
    query: 'q',
    topK: 5,
    filters: { topic: null },
    results: [
      {
        chunkId: 'a',
        distance: 0.1,
        similarity: 0.9,
        document: 'doc',
        metadata: { title: 'T' },
      },
    ],
  },
}

const emptyKb: SupportKBQueryOutcome = {
  ok: true,
  data: {
    collection: 'kinetix_support_kb',
    query: 'q',
    topK: 5,
    filters: { topic: null },
    results: [],
  },
}

const aiOk: HelpSupportAiOutcome = { ok: true, text: 'Here is help.' }
const aiFail: HelpSupportAiOutcome = { ok: false, reason: 'network', message: 'offline' }
const aiEmpty: HelpSupportAiOutcome = { ok: true, text: '   ' }

describe('hybridHelpEscalationGateMet', () => {
  it.each([
    [{ stillNotResolvedClicks: 0, unresolvedCompletedSearchCount: 0 }, false],
    [{ stillNotResolvedClicks: 1, unresolvedCompletedSearchCount: 0 }, false],
    [{ stillNotResolvedClicks: 0, unresolvedCompletedSearchCount: 1 }, false],
    [{ stillNotResolvedClicks: 2, unresolvedCompletedSearchCount: 0 }, true],
    [{ stillNotResolvedClicks: 0, unresolvedCompletedSearchCount: 2 }, true],
    [{ stillNotResolvedClicks: 3, unresolvedCompletedSearchCount: 1 }, true],
  ])('hybridHelpEscalationGateMet(%j) => %s', (input, expected) => {
    expect(hybridHelpEscalationGateMet(input)).toBe(expected)
  })
})

describe('isHelpSupportSearchCycleUnresolved', () => {
  it('is true when retrieval fails', () => {
    const kb: SupportKBQueryOutcome = { ok: false, reason: 'unavailable' }
    expect(isHelpSupportSearchCycleUnresolved(kb, null, aiOk)).toBe(true)
  })

  it('is true when KB empty even if AI ok', () => {
    expect(isHelpSupportSearchCycleUnresolved(emptyKb, null, aiOk)).toBe(true)
  })

  it('is false when KB strong and AI ok with text', () => {
    expect(isHelpSupportSearchCycleUnresolved(strongKb, 0.9, aiOk)).toBe(false)
  })

  it('is true when KB strong but AI failed', () => {
    expect(isHelpSupportSearchCycleUnresolved(strongKb, 0.9, aiFail)).toBe(true)
  })

  it('is true when AI missing', () => {
    expect(isHelpSupportSearchCycleUnresolved(strongKb, 0.9, null)).toBe(true)
  })

  it('is true when AI returns empty text', () => {
    expect(isHelpSupportSearchCycleUnresolved(strongKb, 0.9, aiEmpty)).toBe(true)
  })
})

describe('shouldProposeHelpEscalation', () => {
  it('is false without support outcome', () => {
    expect(
      shouldProposeHelpEscalation({
        supportOutcome: null,
        stillNotResolvedClicks: 2,
        unresolvedCompletedSearchCount: 0,
      }),
    ).toBe(false)
  })

  it('is false when gate not met', () => {
    expect(
      shouldProposeHelpEscalation({
        supportOutcome: strongKb,
        stillNotResolvedClicks: 0,
        unresolvedCompletedSearchCount: 1,
      }),
    ).toBe(false)
  })

  it('is true when gate met and outcome present', () => {
    expect(
      shouldProposeHelpEscalation({
        supportOutcome: strongKb,
        stillNotResolvedClicks: 2,
        unresolvedCompletedSearchCount: 0,
      }),
    ).toBe(true)
  })
})
