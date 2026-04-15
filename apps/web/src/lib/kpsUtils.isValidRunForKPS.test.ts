import { describe, expect, it } from 'vitest'
import { isValidRunForKPS } from './kpsUtils'

describe('isValidRunForKPS', () => {
  it('returns true for valid positive distance and duration', () => {
    expect(isValidRunForKPS({ distance: 1000, duration: 600 })).toBe(true)
  })

  it('returns true for valid near-zero positive decimal values', () => {
    expect(isValidRunForKPS({ distance: 0.1, duration: 0.1 })).toBe(true)
  })

  it('returns false when distance is 0', () => {
    expect(isValidRunForKPS({ distance: 0, duration: 600 })).toBe(false)
  })

  it('returns false when duration is 0', () => {
    expect(isValidRunForKPS({ distance: 1000, duration: 0 })).toBe(false)
  })

  it('returns false when both distance and duration are 0', () => {
    expect(isValidRunForKPS({ distance: 0, duration: 0 })).toBe(false)
  })

  it('returns false for negative distance', () => {
    expect(isValidRunForKPS({ distance: -1000, duration: 600 })).toBe(false)
  })

  it('returns false for negative duration', () => {
    expect(isValidRunForKPS({ distance: 1000, duration: -600 })).toBe(false)
  })

  it('returns false when distance is NaN', () => {
    expect(isValidRunForKPS({ distance: NaN, duration: 600 })).toBe(false)
  })

  it('returns false when duration is NaN', () => {
    expect(isValidRunForKPS({ distance: 1000, duration: NaN })).toBe(false)
  })

  it('returns false when distance is Infinity', () => {
    expect(isValidRunForKPS({ distance: Infinity, duration: 600 })).toBe(false)
  })

  it('returns false when duration is Infinity', () => {
    expect(isValidRunForKPS({ distance: 1000, duration: Infinity })).toBe(false)
  })

  it('returns false when distance is -Infinity', () => {
    expect(isValidRunForKPS({ distance: -Infinity, duration: 600 })).toBe(false)
  })

  it('returns false when duration is -Infinity', () => {
    expect(isValidRunForKPS({ distance: 1000, duration: -Infinity })).toBe(false)
  })
})
