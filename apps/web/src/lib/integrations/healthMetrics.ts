export type HealthMetricSource = 'withings'

interface CanonicalMetricBase<TPayload> {
  userId: string
  source: HealthMetricSource
  /** Stable provider identifier when available; used for idempotent writes. */
  sourceRecordId: string
  /** Exact observation instant in ISO-8601. */
  observedAt: string
  /** UTC date key (YYYY-MM-DD) for summary series. */
  date: string
  metric: TPayload
  /** Pointer to stored raw payload/event for audits and replay. */
  syncRef: string
}

export interface BodyMetricPayload {
  weightKg?: number
  fatMassKg?: number
  fatFreeMassKg?: number
  muscleMassKg?: number
  hydrationPct?: number
  boneMassKg?: number
}

export interface SleepMetricPayload {
  durationSeconds?: number
  deepSleepSeconds?: number
  lightSleepSeconds?: number
  remSleepSeconds?: number
  awakeSeconds?: number
  sleepEfficiencyPct?: number
}

export interface ActivityMetricPayload {
  steps?: number
  distanceMeters?: number
  activeCaloriesKcal?: number
  elevationMeters?: number
  zoneDurationsSeconds?: Record<string, number>
}

export interface WorkoutMetricPayload {
  workoutType?: string
  durationSeconds?: number
  distanceMeters?: number
  caloriesKcal?: number
  avgHeartRateBpm?: number
  maxHeartRateBpm?: number
}

export interface HeartMetricPayload {
  heartRateBpm?: number
  restingHeartRateBpm?: number
  hrvRmssdMs?: number
}

export interface BloodPressureMetricPayload {
  systolicMmHg: number
  diastolicMmHg: number
  heartRateBpm?: number
}

export type BodyMetric = CanonicalMetricBase<BodyMetricPayload>
export type SleepMetric = CanonicalMetricBase<SleepMetricPayload>
export type ActivityMetric = CanonicalMetricBase<ActivityMetricPayload>
export type WorkoutMetric = CanonicalMetricBase<WorkoutMetricPayload>
export type HeartMetric = CanonicalMetricBase<HeartMetricPayload>
export type BloodPressureMetric = CanonicalMetricBase<BloodPressureMetricPayload>

export type CanonicalHealthMetric =
  | ({ family: 'body' } & BodyMetric)
  | ({ family: 'sleep' } & SleepMetric)
  | ({ family: 'activity' } & ActivityMetric)
  | ({ family: 'workout' } & WorkoutMetric)
  | ({ family: 'heart' } & HeartMetric)
  | ({ family: 'blood_pressure' } & BloodPressureMetric)

export function toDateKey(isoOrEpochMs: string | number): string {
  const d = typeof isoOrEpochMs === 'number' ? new Date(isoOrEpochMs) : new Date(isoOrEpochMs)
  return d.toISOString().slice(0, 10)
}
