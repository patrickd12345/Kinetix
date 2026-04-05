import { describe, it, expect } from 'vitest'
import {
  inferHelpTopicFromQuery,
  isWeakOrEmptyRetrieval,
  getDeterministicFallbackSections,
  getBestSupportSimilarity,
  isUnresolvedRetrievalOutcome,
  shouldProposeEscalation,
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

describe('shouldProposeEscalation', () => {
  it('proposes when support query failed', () => {
    expect(
      shouldProposeEscalation({
        bestSimilarity: null,
        attemptCount: 1,
        supportOutcome: { ok: false, reason: 'unavailable' },
        userMarkedUnresolved: false,
      })
    ).toBe(true)
  })

  it('proposes when best similarity is below threshold', () => {
    expect(
      shouldProposeEscalation({
        bestSimilarity: 0.2,
        attemptCount: 1,
        supportOutcome: {
          ok: true,
          data: {
            collection: 'kinetix_support_kb',
            query: 'q',
            topK: 5,
            filters: { topic: null },
            results: [
              { chunkId: 'a', distance: 1, similarity: 0.2, document: '', metadata: {} },
            ],
          },
        },
        userMarkedUnresolved: false,
      })
    ).toBe(true)
  })

  it('proposes when user marks unresolved', () => {
    expect(
      shouldProposeEscalation({
        bestSimilarity: 0.9,
        attemptCount: 1,
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
        userMarkedUnresolved: true,
      })
    ).toBe(true)
  })

  it('proposes on second weak attempt', () => {
    const weak = {
      ok: true as const,
      data: {
        collection: 'kinetix_support_kb',
        query: 'q',
        topK: 5,
        filters: { topic: null },
        results: [
          { chunkId: 'a', distance: 1, similarity: 0.05, document: '', metadata: {} },
        ],
      },
    }
    expect(
      shouldProposeEscalation({
        bestSimilarity: 0.05,
        attemptCount: 2,
        supportOutcome: weak,
        userMarkedUnresolved: false,
      })
    ).toBe(true)
  })
})
