export const TIMELINE_MIN_HORIZON_DAYS = 7
export const TIMELINE_MAX_HORIZON_DAYS = 28

/** FNV-1a style 32-bit hash for deterministic tie-breaking and jitter inside the horizon. */
export function hashString32(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h | 0
}

/**
 * Map a seed string to an integer in [minDays, maxDays] inclusive (deterministic).
 */
export function projectDayOffsetInHorizon(seed: string, minDays: number, maxDays: number): number {
  const lo = Math.min(minDays, maxDays)
  const hi = Math.max(minDays, maxDays)
  const span = hi - lo + 1
  const h = hashString32(seed)
  return lo + (Math.abs(h) % span)
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/**
 * Calendar date for `anchor + dayOffset` in local time (matches how users read "this week").
 */
export function addDaysIsoDate(anchor: Date, dayOffset: number): string {
  const base = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  base.setDate(base.getDate() + dayOffset)
  const y = base.getFullYear()
  const m = base.getMonth() + 1
  const d = base.getDate()
  return `${y}-${pad2(m)}-${pad2(d)}`
}

export function clampHorizonDayOffset(dayOffset: number): number {
  if (dayOffset < TIMELINE_MIN_HORIZON_DAYS) return TIMELINE_MIN_HORIZON_DAYS
  if (dayOffset > TIMELINE_MAX_HORIZON_DAYS) return TIMELINE_MAX_HORIZON_DAYS
  return dayOffset
}
