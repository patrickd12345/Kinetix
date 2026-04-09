import { describe, expect, it } from 'vitest'
import { computePeriodization } from './periodizationEngine'

const baseInput = {
  goal: {
    distance: 'Half' as const,
    eventDate: '2026-12-31T12:00:00.000Z',
    priority: 'improve' as const,
  },
  prediction: {
    direction: 'stable' as const,
    confidence: 0.7,
    projectedKps7d: 92,
    projectedKps28d: 93,
    message: '',
  },
  fatigue: {
    level: 'low' as const,
    message: '',
  },
}

describe('computePeriodization', () => {
  it('detects base phase', () => {
    const result = computePeriodization({
      ...baseInput,
      now: new Date('2026-08-01T00:00:00.000Z'),
    })
    expect(result.phase).toBe('base')
  })

  it('detects build phase', () => {
    const result = computePeriodization({
      ...baseInput,
      now: new Date('2026-10-20T00:00:00.000Z'),
    })
    expect(result.phase).toBe('build')
  })

  it('detects peak phase', () => {
    const result = computePeriodization({
      ...baseInput,
      now: new Date('2026-11-30T00:00:00.000Z'),
    })
    expect(result.phase).toBe('peak')
  })

  it('detects taper phase', () => {
    const result = computePeriodization({
      ...baseInput,
      now: new Date('2026-12-25T00:00:00.000Z'),
    })
    expect(result.phase).toBe('taper')
  })

  it('returns no-goal fallback', () => {
    const result = computePeriodization({
      goal: null,
      prediction: baseInput.prediction,
      fatigue: baseInput.fatigue,
      now: new Date('2026-12-01T00:00:00.000Z'),
    })
    expect(result.phase).toBe('base')
    expect(result.nextPhase).toBeNull()
    expect(result.focus).toMatch(/Set a goal/i)
  })
})
