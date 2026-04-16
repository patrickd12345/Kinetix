import { describe, it, expect } from 'vitest'
import {
  inferHelpTopicFromQuery,
  isWeakOrEmptyRetrieval,
  getDeterministicFallbackSections,
  getBestSupportSimilarity,
  isUnresolvedRetrievalOutcome,
  shouldProposeHelpEscalation,
  MIN_USEFUL_SIMILARITY,
} from './helpCenterFallback'

describe('inferHelpTopicFromQuery', () => {
  it('detects sync topic', () => {
    expect(inferHelpTopicFromQuery('Strava OAuth not working')).toBe('sync')
    expect(inferHelpTopicFromQuery('withings scale')).toBe('sync')
  })

  it('detects import topic', () => {
    expect(inferHelpTopicFromQuery('import garmin zip')).toBe('import')
  })

  it('detects kps topic', () => {
    expect(inferHelpTopicFromQuery('where are kps charts')).toBe('kps')
  })

  it('defaults to general', () => {
    expect(inferHelpTopicFromQuery('hello')).toBe('general')
  })
})

describe('isWeakOrEmptyRetrieval', () => {
  it('is true for empty results', () => {
    expect(isWeakOrEmptyRetrieval([])).toBe(true)
  })

  it('is false when best similarity meets threshold', () => {
    expect(
      isWeakOrEmptyRetrieval([
        { chunkId: 'a', distance: 0, similarity: MIN_USEFUL_SIMILARITY, document: '', metadata: {} },
      ])
    ).toBe(false)
    expect(
      isWeakOrEmptyRetrieval([
        { chunkId: 'a', distance: 0, similarity: MIN_USEFUL_SIMILARITY + 0.01, document: '', metadata: {} },
      ])
    ).toBe(false)
  })

  it('is true when all similarities are below threshold', () => {
    expect(
      isWeakOrEmptyRetrieval([
        { chunkId: 'a', distance: 1, similarity: 0.05, document: '', metadata: {} },
        { chunkId: 'b', distance: 1, similarity: 0.08, document: '', metadata: {} },
      ])
    ).toBe(true)
  })
})

describe('getDeterministicFallbackSections', () => {
  it('includes topic-specific section for sync queries', () => {
    const sections = getDeterministicFallbackSections('connect strava')
    const titles = sections.map((s) => s.title)
    expect(titles.some((t) => /Connections/i.test(t))).toBe(true)
    expect(titles.some((t) => /Always try/i.test(t))).toBe(true)
  })
})

describe('isUnresolvedRetrievalOutcome', () => {
  it('is true for http failure', () => {
    expect(isUnresolvedRetrievalOutcome({ ok: false, reason: 'http_error', status: 500 }, null)).toBe(true)
  })

  it('is false for strong match', () => {
    expect(
      isUnresolvedRetrievalOutcome(
        {
          ok: true,
          data: {
            collection: 'kinetix_support_kb',
            query: 'q',
            topK: 5,
            filters: { topic: null },
            results: [
              { chunkId: 'a', distance: 0.1, similarity: 0.9, document: '', metadata: {} },
            ],
          },
        },
        0.9,
      ),
    ).toBe(false)
  })
})

describe('getBestSupportSimilarity', () => {
  it('returns null for empty results', () => {
    expect(getBestSupportSimilarity([])).toBe(null)
  })

  it('returns max similarity', () => {
    expect(
      getBestSupportSimilarity([
        { chunkId: 'a', distance: 1, similarity: 0.2, document: '', metadata: {} },
        { chunkId: 'b', distance: 1, similarity: 0.6, document: '', metadata: {} },
      ])
    ).toBe(0.6)
  })
})

describe('shouldProposeHelpEscalation', () => {
  const failedOutcome = { ok: false as const, reason: 'unavailable' as const }

  it('does not propose on first signal alone (failed retrieval, gate not met)', () => {
    expect(
      shouldProposeHelpEscalation({
        supportOutcome: failedOutcome,
        stillNotResolvedClicks: 0,
        unresolvedCompletedSearchCount: 1,
      }),
    ).toBe(false)
  })

  it('proposes when two unresolved completed searches recorded', () => {
    expect(
      shouldProposeHelpEscalation({
        supportOutcome: failedOutcome,
        stillNotResolvedClicks: 0,
        unresolvedCompletedSearchCount: 2,
      }),
    ).toBe(true)
  })

  it('proposes when still-not-resolved clicked twice even with strong KB outcome', () => {
    expect(
      shouldProposeHelpEscalation({
        supportOutcome: {
          ok: true,
          data: {
            collection: 'kinetix_support_kb',
            query: 'q',
            topK: 5,
            filters: { topic: null },
            results: [
              { chunkId: 'a', distance: 0.1, similarity: 0.9, document: '', metadata: {} },
            ],
          },
        },
        stillNotResolvedClicks: 2,
        unresolvedCompletedSearchCount: 0,
      }),
    ).toBe(true)
  })

  it('does not propose without support outcome', () => {
    expect(
      shouldProposeHelpEscalation({
        supportOutcome: null,
        stillNotResolvedClicks: 2,
        unresolvedCompletedSearchCount: 2,
      }),
    ).toBe(false)
  })
})
