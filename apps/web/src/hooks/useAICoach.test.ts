import { describe, expect, it } from 'vitest'
import { AI_COACH_FALLBACK_RESULT, parseAICoachResult } from './useAICoach'

describe('parseAICoachResult', () => {
  it('accepts strict title and insight JSON', () => {
    expect(parseAICoachResult('{"title":"Strong pacing","insight":"Hold this effort."}')).toEqual({
      title: 'Strong pacing',
      insight: 'Hold this effort.',
    })
  })

  it('rejects invalid JSON and wrong schema responses', () => {
    expect(parseAICoachResult('not json')).toBeNull()
    expect(parseAICoachResult('{"title":"Missing insight"}')).toBeNull()
    expect(parseAICoachResult('{"title":"","insight":"Body"}')).toBeNull()
  })

  it('keeps the deterministic fallback stable', () => {
    expect(AI_COACH_FALLBACK_RESULT).toEqual({
      title: 'Analysis unavailable',
      insight: 'The coach response could not be validated. Review this run manually and try again later.',
    })
  })
})
