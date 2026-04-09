import type {
  ActivityMetric,
  BloodPressureMetric,
  BodyMetric,
  CanonicalHealthMetric,
  HeartMetric,
  SleepMetric,
  WorkoutMetric,
} from '../healthMetrics'
import { toDateKey } from '../healthMetrics'
import type { WithingsMeasureGroup, WithingsRawEvent } from './types'

const TYPE_WEIGHT = 1
const TYPE_FAT_FREE_MASS = 5
const TYPE_FAT_RATIO = 6
const TYPE_FAT_MASS = 8
const TYPE_DIASTOLIC = 9
const TYPE_SYSTOLIC = 10
const TYPE_HEART_PULSE = 11
const TYPE_MUSCLE_MASS = 76
const TYPE_HYDRATION = 77
const TYPE_BONE_MASS = 88
const TYPE_HRV_RMSSD = 135

const WITHINGS_SOURCE = 'withings' as const

function applyUnit(value: number, exp: number): number {
  return value * Math.pow(10, exp)
}

function metricId(prefix: string, recordId: string | number): string {
  return `${prefix}:${recordId}`
}

function toObservedIso(value: string | number): string {
  const unix = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (!Number.isFinite(unix) || unix <= 0) return new Date(0).toISOString()
  return new Date(unix * 1000).toISOString()
}

export function normalizeBodyMeasures(userId: string, syncRef: string, groups: WithingsMeasureGroup[]): BodyMetric[] {
  const records: BodyMetric[] = []
  for (const grp of groups) {
    const observedAt = toObservedIso(grp.date)
    const payload: BodyMetric['metric'] = {}
    for (const m of grp.measures ?? []) {
      const value = applyUnit(m.value, m.unit)
      if (m.type === TYPE_WEIGHT) payload.weightKg = value
      if (m.type === TYPE_FAT_MASS) payload.fatMassKg = value
      if (m.type === TYPE_FAT_FREE_MASS) payload.fatFreeMassKg = value
      if (m.type === TYPE_MUSCLE_MASS) payload.muscleMassKg = value
      if (m.type === TYPE_HYDRATION) payload.hydrationPct = value
      if (m.type === TYPE_BONE_MASS) payload.boneMassKg = value
      if (m.type === TYPE_FAT_RATIO && payload.hydrationPct == null) payload.hydrationPct = value
    }
    if (Object.keys(payload).length === 0) continue
    records.push({
      userId,
      source: WITHINGS_SOURCE,
      sourceRecordId: metricId('measuregrp', grp.grpid ?? grp.date),
      observedAt,
      date: toDateKey(observedAt),
      metric: payload,
      syncRef,
    })
  }
  return records
}

export function normalizeBloodPressure(userId: string, syncRef: string, groups: WithingsMeasureGroup[]): BloodPressureMetric[] {
  const out: BloodPressureMetric[] = []
  for (const grp of groups) {
    let systolic: number | null = null
    let diastolic: number | null = null
    let heartRate: number | undefined
    for (const m of grp.measures ?? []) {
      const value = applyUnit(m.value, m.unit)
      if (m.type === TYPE_SYSTOLIC) systolic = value
      if (m.type === TYPE_DIASTOLIC) diastolic = value
      if (m.type === TYPE_HEART_PULSE) heartRate = value
    }
    if (systolic == null || diastolic == null) continue
    const observedAt = toObservedIso(grp.date)
    out.push({
      userId,
      source: WITHINGS_SOURCE,
      sourceRecordId: metricId('bp', grp.grpid ?? grp.date),
      observedAt,
      date: toDateKey(observedAt),
      metric: { systolicMmHg: systolic, diastolicMmHg: diastolic, heartRateBpm: heartRate },
      syncRef,
    })
  }
  return out
}

type ActivityPayload = {
  date: string
  steps?: number
  distance?: number
  calories?: number
  elevation?: number
  hr_zone_0?: number
  hr_zone_1?: number
  hr_zone_2?: number
  hr_zone_3?: number
}

export function normalizeActivity(userId: string, syncRef: string, rows: ActivityPayload[]): ActivityMetric[] {
  return rows.map((row) => ({
    userId,
    source: WITHINGS_SOURCE,
    sourceRecordId: metricId('activity', row.date),
    observedAt: new Date(`${row.date}T12:00:00.000Z`).toISOString(),
    date: row.date,
    metric: {
      steps: row.steps,
      distanceMeters: row.distance,
      activeCaloriesKcal: row.calories,
      elevationMeters: row.elevation,
      zoneDurationsSeconds: {
        z0: row.hr_zone_0 ?? 0,
        z1: row.hr_zone_1 ?? 0,
        z2: row.hr_zone_2 ?? 0,
        z3: row.hr_zone_3 ?? 0,
      },
    },
    syncRef,
  }))
}

type SleepPayload = {
  id?: number | string
  startdate: number
  enddate: number
  deepsleepduration?: number
  lightsleepduration?: number
  remsleepduration?: number
  wakeupduration?: number
  durationtosleep?: number
}

export function normalizeSleep(userId: string, syncRef: string, rows: SleepPayload[]): SleepMetric[] {
  return rows.map((row) => {
    const observedAt = new Date(row.enddate * 1000).toISOString()
    const total = (row.enddate - row.startdate) - (row.durationtosleep ?? 0)
    const asleep = (row.deepsleepduration ?? 0) + (row.lightsleepduration ?? 0) + (row.remsleepduration ?? 0)
    const efficiency = total > 0 ? Math.round((asleep / total) * 1000) / 10 : undefined
    return {
      userId,
      source: WITHINGS_SOURCE,
      sourceRecordId: metricId('sleep', row.id ?? `${row.startdate}-${row.enddate}`),
      observedAt,
      date: toDateKey(observedAt),
      metric: {
        durationSeconds: total,
        deepSleepSeconds: row.deepsleepduration,
        lightSleepSeconds: row.lightsleepduration,
        remSleepSeconds: row.remsleepduration,
        awakeSeconds: row.wakeupduration,
        sleepEfficiencyPct: efficiency,
      },
      syncRef,
    }
  })
}

type WorkoutPayload = {
  id: number | string
  startdate: number
  enddate: number
  category?: number | string
  distance?: number
  calories?: number
  hr_average?: number
  hr_max?: number
}

export function normalizeWorkouts(userId: string, syncRef: string, rows: WorkoutPayload[]): WorkoutMetric[] {
  return rows.map((row) => {
    const observedAt = new Date(row.startdate * 1000).toISOString()
    return {
      userId,
      source: WITHINGS_SOURCE,
      sourceRecordId: metricId('workout', row.id),
      observedAt,
      date: toDateKey(observedAt),
      metric: {
        workoutType: row.category == null ? undefined : String(row.category),
        durationSeconds: Math.max(0, row.enddate - row.startdate),
        distanceMeters: row.distance,
        caloriesKcal: row.calories,
        avgHeartRateBpm: row.hr_average,
        maxHeartRateBpm: row.hr_max,
      },
      syncRef,
    }
  })
}

export function normalizeHeartFromMeasures(userId: string, syncRef: string, groups: WithingsMeasureGroup[]): HeartMetric[] {
  const out: HeartMetric[] = []
  for (const grp of groups) {
    let heartRate: number | undefined
    let hrv: number | undefined
    for (const m of grp.measures ?? []) {
      const value = applyUnit(m.value, m.unit)
      if (m.type === TYPE_HEART_PULSE) heartRate = value
      if (m.type === TYPE_HRV_RMSSD) hrv = value
    }
    if (heartRate == null && hrv == null) continue
    const observedAt = toObservedIso(grp.date)
    out.push({
      userId,
      source: WITHINGS_SOURCE,
      sourceRecordId: metricId('heart', grp.grpid ?? grp.date),
      observedAt,
      date: toDateKey(observedAt),
      metric: { heartRateBpm: heartRate, hrvRmssdMs: hrv },
      syncRef,
    })
  }
  return out
}

export function toRawEvent(userId: string, family: WithingsRawEvent['family'], payload: unknown): WithingsRawEvent {
  const createdAt = new Date().toISOString()
  const payloadText = JSON.stringify(payload)
  let checksum = 0
  for (let i = 0; i < payloadText.length; i++) checksum = (checksum + payloadText.charCodeAt(i) * (i + 1)) % 1_000_000_007
  return {
    id: `${family}:${userId}:${createdAt}:${checksum.toString(36)}`,
    userId,
    family,
    createdAt,
    payload,
  }
}

export function asCanonicalMetrics(groups: {
  body?: BodyMetric[]
  sleep?: SleepMetric[]
  activity?: ActivityMetric[]
  workout?: WorkoutMetric[]
  heart?: HeartMetric[]
  bloodPressure?: BloodPressureMetric[]
}): CanonicalHealthMetric[] {
  return [
    ...(groups.body ?? []).map((m) => ({ family: 'body' as const, ...m })),
    ...(groups.sleep ?? []).map((m) => ({ family: 'sleep' as const, ...m })),
    ...(groups.activity ?? []).map((m) => ({ family: 'activity' as const, ...m })),
    ...(groups.workout ?? []).map((m) => ({ family: 'workout' as const, ...m })),
    ...(groups.heart ?? []).map((m) => ({ family: 'heart' as const, ...m })),
    ...(groups.bloodPressure ?? []).map((m) => ({ family: 'blood_pressure' as const, ...m })),
  ]
}
