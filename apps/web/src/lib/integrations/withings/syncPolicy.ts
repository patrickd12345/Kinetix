export type WithingsSyncReason =
  | 'scheduled_due'
  | 'not_due'
  | 'manual'
  | 'flag_disabled'
  | 'missing_connection'

export interface WithingsSyncPolicyInput {
  now: Date
  manual: boolean
  featureEnabled: boolean
  expandedSyncEnabled: boolean
  hasConnection: boolean
  syncTimes: [string, string]
  lastSuccessfulScheduledSlotKey: string | null
}

export interface WithingsSyncDecision {
  shouldSync: boolean
  reason: WithingsSyncReason
  scheduledTime?: string
  scheduledSlotKey?: string
  nextEligibleAt?: string
}

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export function isValidLocalTimeHHMM(value: string): boolean {
  return TIME_RE.test(value)
}

export function normalizeSyncTimes(times: string[]): [string, string] {
  const valid = times.filter(isValidLocalTimeHHMM).sort((a, b) => a.localeCompare(b))
  if (valid.length >= 2) return [valid[0], valid[1]]
  return ['08:00', '20:00']
}

function toSlotKey(localDate: string, time: string): string {
  return `${localDate}@${time}`
}

function localDateKey(now: Date): string {
  const yyyy = now.getFullYear()
  const mm = `${now.getMonth() + 1}`.padStart(2, '0')
  const dd = `${now.getDate()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function localTimeValue(now: Date): string {
  const hh = `${now.getHours()}`.padStart(2, '0')
  const mm = `${now.getMinutes()}`.padStart(2, '0')
  return `${hh}:${mm}`
}

function nextEligibleIso(now: Date, schedule: [string, string]): string {
  const current = localTimeValue(now)
  const date = localDateKey(now)
  if (current < schedule[0]) return new Date(`${date}T${schedule[0]}:00`).toISOString()
  if (current < schedule[1]) return new Date(`${date}T${schedule[1]}:00`).toISOString()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const tDate = localDateKey(tomorrow)
  return new Date(`${tDate}T${schedule[0]}:00`).toISOString()
}

export function evaluateWithingsSyncPolicy(input: WithingsSyncPolicyInput): WithingsSyncDecision {
  if (!input.featureEnabled || !input.expandedSyncEnabled) {
    return { shouldSync: false, reason: 'flag_disabled' }
  }
  if (!input.hasConnection) {
    return { shouldSync: false, reason: 'missing_connection' }
  }
  if (input.manual) {
    return { shouldSync: true, reason: 'manual' }
  }

  const schedule = normalizeSyncTimes(input.syncTimes)
  const date = localDateKey(input.now)
  const nowTime = localTimeValue(input.now)

  const dueSlots = schedule
    .filter((time) => nowTime >= time)
    .map((time) => ({ time, key: toSlotKey(date, time) }))

  const nextDue = dueSlots.reverse().find((slot) => slot.key !== input.lastSuccessfulScheduledSlotKey)
  if (nextDue) {
    return {
      shouldSync: true,
      reason: 'scheduled_due',
      scheduledTime: nextDue.time,
      scheduledSlotKey: nextDue.key,
    }
  }

  return {
    shouldSync: false,
    reason: 'not_due',
    nextEligibleAt: nextEligibleIso(input.now, schedule),
  }
}
