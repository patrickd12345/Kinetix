import { describe, it, expect } from 'vitest'
import {
  inferHelpTopicFromQuery,
  isWeakOrEmptyRetrieval,
  getDeterministicFallbackSections,
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
