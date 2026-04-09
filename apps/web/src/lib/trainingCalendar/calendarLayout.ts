function addDaysUtc(base: Date, dayOffset: number): Date {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + dayOffset)
  return d
}

function labelForDate(value: Date): string {
  return value.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
}

export function buildCalendarDates(now: Date, horizonDays: number): { date: string; label: string }[] {
  const safeHorizon = horizonDays >= 14 ? 14 : 7
  return Array.from({ length: safeHorizon }, (_, index) => {
    const date = addDaysUtc(now, index)
    return {
      date: date.toISOString().slice(0, 10),
      label: labelForDate(date),
    }
  })
}

export const __testables = {
  addDaysUtc,
}
