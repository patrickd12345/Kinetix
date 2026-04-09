import type { CanonicalHealthMetric } from '../healthMetrics'

export type WithingsMetricFamily = 'body' | 'activity' | 'workout' | 'sleep' | 'heart' | 'blood_pressure'

export interface WithingsCursor {
  lastMeasureUpdate?: number
  lastActivityDate?: string
  lastWorkoutDate?: string
  lastSleepDate?: string
  lastHeartDate?: string
}

export interface WithingsRawEvent {
  id: string
  userId: string
  family: WithingsMetricFamily
  createdAt: string
  payload: unknown
}

export interface WithingsSyncRun {
  id: string
  userId: string
  provider: 'withings'
  startedAt: string
  finishedAt?: string
  status: 'started' | 'success' | 'partial' | 'failed'
  checkpointBefore: WithingsCursor
  checkpointAfter: WithingsCursor
  counts: Record<WithingsMetricFamily, number>
  errors: string[]
}

export interface WithingsCapabilityMap {
  body: boolean
  activity: boolean
  workout: boolean
  sleep: boolean
  heart: boolean
  bloodPressure: boolean
}

export interface WithingsSyncDomainResult {
  rawEvents: WithingsRawEvent[]
  metrics: CanonicalHealthMetric[]
  checkpointPatch?: Partial<WithingsCursor>
  capabilities: Partial<WithingsCapabilityMap>
  errors?: string[]
}

export interface WithingsSyncResult {
  run: WithingsSyncRun
  capabilities: WithingsCapabilityMap
  metricsWritten: number
}

export interface WithingsAuthCredentials {
  accessToken: string
  refreshToken: string
  userId: string
  expiresAt: number
}

export interface WithingsApiEnvelope<TBody> {
  status: number
  body?: TBody & { error?: string }
}

export interface WithingsMeasure {
  value: number
  unit: number
  type: number
}

export interface WithingsMeasureGroup {
  grpid?: number
  attrib?: number
  date: string | number
  created?: number
  modified?: number
  measures?: WithingsMeasure[]
}
