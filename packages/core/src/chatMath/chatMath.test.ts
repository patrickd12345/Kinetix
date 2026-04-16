import { describe, expect, it } from 'vitest'
import { isMathBearingMessage, tryComputeVerifiedMath } from './compute'
import { extractFirstDistanceMeters, extractPaceTokens, formatPaceSecondsPerKm } from './parse'

describe('chatMath parse', () => {
  it('extracts 5k shorthand as meters', () => {
    expect(extractFirstDistanceMeters('ran a 5k in 20:00')).toBe(5000)
  })

  it('extracts pace tokens in order', () => {
    const t = extractPaceTokens('5:20/km and 5:45/km over 1 km each')
    expect(t).toHaveLength(2)
    expect(t[0].secondsPerKm).toBe(5 * 60 + 20)
    expect(t[1].secondsPerKm).toBe(5 * 60 + 45)
  })
})

describe('tryComputeVerifiedMath', () => {
  it('computes distance-weighted average pace for equal 1 km segments (regression: not sum of paces)', () => {
    const msg = 'What is my average pace for 5:20/km and 5:45/km over 1 km each?'
    expect(isMathBearingMessage(msg)).toBe(true)
    const r = tryComputeVerifiedMath(msg, {})
    expect(r).not.toBeNull()
    expect(r!.operation).toBe('average_pace_segments')
    expect(r!.canAnswer).toBe(true)
    expect(r!.outputs.averagePaceSecondsPerKm as number).toBeCloseTo(332.5, 5)
    expect(r!.formatted.averagePaceMetric).toContain('5:32.5')
    expect(formatPaceSecondsPerKm(r!.outputs.averagePaceSecondsPerKm as number)).toBe('5:32.5')
  })

  it('fail-closes when segment distances are missing', () => {
    const r = tryComputeVerifiedMath('average pace of 5:20/km and 5:45/km', {})
    expect(r).not.toBeNull()
    expect(r!.canAnswer).toBe(false)
    expect(r!.missingInputs).toContain('distance_each_segment_m')
  })

  it('returns null for clearly non-math chat', () => {
    expect(tryComputeVerifiedMath('How should I breathe on long runs?', {})).toBeNull()
  })
})
