import type { FatigueResult, ReadinessResult } from '../intelligence/types'
import type { DailyRecommendation, PlannedSession, PredictionDirection, RecentActivitySummary, SessionType } from './types'

interface BuildMicrocycleInput {
  today: DailyRecommendation
  readiness: ReadinessResult
  fatigue: FatigueResult
  predictionDirection: PredictionDirection
  activity: RecentActivitySummary
}

const DAY_LABELS = ['Today', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7']
const QUALITY_TYPES: SessionType[] = ['interval', 'tempo', 'long']

function sessionDefaults(sessionType: SessionType): Omit<PlannedSession, 'dayOffset' | 'label' | 'sessionType'> {
  if (sessionType === 'rest') return { durationMinutes: null, intensity: null }
  if (sessionType === 'recovery') return { durationMinutes: 25, intensity: 'low' }
  if (sessionType === 'easy') return { durationMinutes: 40, intensity: 'low' }
  if (sessionType === 'tempo') return { durationMinutes: 35, intensity: 'moderate-high' }
  if (sessionType === 'interval') return { durationMinutes: 45, intensity: 'high' }
  return { durationMinutes: 75, intensity: 'moderate' }
}

function makeSession(dayOffset: number, sessionType: SessionType): PlannedSession {
  return {
    dayOffset,
    label: DAY_LABELS[dayOffset] ?? `Day ${dayOffset + 1}`,
    sessionType,
    ...sessionDefaults(sessionType),
  }
}

function isQuality(sessionType: SessionType): boolean {
  return QUALITY_TYPES.includes(sessionType)
}

function noBackToBackIntervalTempo(week: PlannedSession[]): PlannedSession[] {
  for (let i = 1; i < week.length; i += 1) {
    const prev = week[i - 1]?.sessionType
    const current = week[i]?.sessionType
    const isBlockedPair =
      (prev === 'interval' && current === 'tempo') ||
      (prev === 'tempo' && current === 'interval')
    if (isBlockedPair) {
      week[i] = makeSession(i, 'easy')
    }
  }
  return week
}

function enforceLimits(week: PlannedSession[]): PlannedSession[] {
  let qualityCount = 0
  let longCount = 0

  for (let i = 0; i < week.length; i += 1) {
    const type = week[i].sessionType
    if (isQuality(type)) {
      qualityCount += 1
      if (qualityCount > 2) week[i] = makeSession(i, 'easy')
    }
    if (type === 'long') {
      longCount += 1
      if (longCount > 1) week[i] = makeSession(i, 'easy')
    }
  }

  const hasLowLoad = week.some((session) => ['rest', 'recovery', 'easy'].includes(session.sessionType))
  if (!hasLowLoad) {
    week[week.length - 1] = makeSession(week.length - 1, 'recovery')
  }

  return noBackToBackIntervalTempo(week)
}

export function buildMicrocycle(input: BuildMicrocycleInput): PlannedSession[] {
  const { today, readiness, fatigue, predictionDirection, activity } = input

  if (fatigue.level === 'high') {
    const highFatigueWeek: SessionType[] = [
      today.sessionType,
      'rest',
      'recovery',
      'easy',
      'recovery',
      'easy',
      'rest',
    ]
    return highFatigueWeek.map((sessionType, dayOffset) => makeSession(dayOffset, sessionType))
  }

  const improving = readiness.status === 'high' && predictionDirection === 'improving'
  const allowTwoQuality = improving && activity.confidence >= 0.6

  const baseline: SessionType[] = [today.sessionType, 'easy', 'recovery', 'easy', 'rest', 'easy', 'recovery']

  if (allowTwoQuality) {
    const secondQuality: SessionType = activity.longSessionsLast7d > 0 ? 'tempo' : 'long'
    baseline[2] = baseline[0] === 'interval' ? 'easy' : 'interval'
    baseline[5] = secondQuality
  } else if (readiness.status === 'moderate' && activity.qualitySessionsLast7d === 0) {
    baseline[3] = 'tempo'
  }

  const week = baseline.map((sessionType, dayOffset) => makeSession(dayOffset, sessionType))
  return enforceLimits(week)
}
