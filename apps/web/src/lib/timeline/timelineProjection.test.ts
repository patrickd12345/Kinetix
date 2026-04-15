import { describe, expect, it } from 'vitest'
import {
  TIMELINE_MAX_HORIZON_DAYS,
  TIMELINE_MIN_HORIZON_DAYS,
  addDaysIsoDate,
  clampHorizonDayOffset,
  hashString32,
  projectDayOffsetInHorizon,
} from './timelineProjection'

describe('timelineProjection', () => {
  it('hashString32 is deterministic', () => {
    expect(hashString32('hello')).toBe(hashString32('hello'))
    expect(hashString32('hello')).not.toBe(hashString32('hellp'))
  })

  it('projectDayOffsetInHorizon stays within bounds', () => {
    for (let i = 0; i < 20; i++) {
      const o = projectDayOffsetInHorizon(`k${i}`, TIMELINE_MIN_HORIZON_DAYS, TIMELINE_MAX_HORIZON_DAYS)
      expect(o).toBeGreaterThanOrEqual(TIMELINE_MIN_HORIZON_DAYS)
      expect(o).toBeLessThanOrEqual(TIMELINE_MAX_HORIZON_DAYS)
    }
  })

  it('addDaysIsoDate rolls local calendar', () => {
    const anchor = new Date(2026, 3, 9)
    expect(addDaysIsoDate(anchor, 0)).toBe('2026-04-09')
    expect(addDaysIsoDate(anchor, 7)).toBe('2026-04-16')
    expect(addDaysIsoDate(anchor, 28)).toBe('2026-05-07')
  })

  it('clampHorizonDayOffset enforces 7–28', () => {
    expect(clampHorizonDayOffset(3)).toBe(TIMELINE_MIN_HORIZON_DAYS)
    expect(clampHorizonDayOffset(40)).toBe(TIMELINE_MAX_HORIZON_DAYS)
    expect(clampHorizonDayOffset(14)).toBe(14)
  })
})
