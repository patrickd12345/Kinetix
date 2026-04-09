import { describe, expect, it } from 'vitest'
import { rewriteMetricCoachPaces, sanitizeCoachPaceMath } from './coachUnits'

describe('rewriteMetricCoachPaces', () => {
  it('converts /mile and /mi paces to /km', () => {
    const raw =
      'Step 1: Slower tempo (e.g., 8:35/mile)\nStep 2: Even pace each mile or kilometer (e.g., 9:15/mi)'
    const out = rewriteMetricCoachPaces(raw)
    expect(out).toContain('5:20/km')
    expect(out).toContain('5:45/km')
    expect(out).not.toMatch(/\/mile/i)
    expect(out).not.toMatch(/\/mi\b/i)
    expect(out).toMatch(/each kilometer/i)
  })
})

describe('sanitizeCoachPaceMath', () => {
  it('removes fake "total pace" clause after two segment paces', () => {
    const raw =
      'For example, if your last segment was at an average pace of 5:20/km, your next segment should be at 5:45/km for a total pace of 11:05/km.'
    const out = sanitizeCoachPaceMath(raw)
    expect(out).not.toMatch(/total pace/i)
    expect(out).toMatch(/5:20\/km/)
    expect(out).toMatch(/5:45\/km/)
    expect(out).not.toMatch(/11:05/)
  })
})
