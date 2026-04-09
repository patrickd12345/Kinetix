import type { TimelineEngineInput, TimelineEngineResult, TimelineEvent, TimelineEventType } from './types'
import {
  TIMELINE_MAX_HORIZON_DAYS,
  TIMELINE_MIN_HORIZON_DAYS,
  addDaysIsoDate,
  clampHorizonDayOffset,
  projectDayOffsetInHorizon,
} from './timelineProjection'

const MAX_EVENTS = 3

function makeEvent(
  type: TimelineEventType,
  anchor: Date,
  dayOffset: number,
  title: string,
  detail: string,
  priority: number
): TimelineEvent {
  const o = clampHorizonDayOffset(dayOffset)
  return {
    type,
    dayOffset: o,
    targetDate: addDaysIsoDate(anchor, o),
    title,
    detail,
    priority,
  }
}

function candidateTaperWindow(input: TimelineEngineInput): TimelineEvent | null {
  const { anchorDate, goalProgress, memory, periodization, trainingPlan } = input
  const goalDays = goalProgress?.daysRemaining
  const inHorizon =
    goalDays != null && goalDays >= TIMELINE_MIN_HORIZON_DAYS && goalDays <= TIMELINE_MAX_HORIZON_DAYS
  const memoryTaper = memory?.latest?.decision === 'taper'
  const phaseTaper = periodization?.phase === 'taper'

  if (!inHorizon && !memoryTaper && !phaseTaper) return null

  let dayOffset: number
  if (inHorizon) {
    dayOffset = clampHorizonDayOffset(goalDays!)
  } else {
    dayOffset = projectDayOffsetInHorizon(
      `taper:${periodization?.phase ?? 'na'}:${memory?.latest?.date ?? 'na'}`,
      TIMELINE_MIN_HORIZON_DAYS,
      TIMELINE_MAX_HORIZON_DAYS
    )
  }

  const title = 'Taper window ahead'
  let detail = 'Plan eases volume toward race day; keep sleep and easy runs prioritized.'
  if (memoryTaper && memory?.latest) {
    detail = `Coach memory flags taper (${memory.latest.confidence} confidence) — align easy days with that plan.`
  } else if (phaseTaper) {
    detail = 'Periodization is in taper — protect freshness and avoid last-minute spikes.'
  } else if (inHorizon && goalDays != null) {
    detail = `About ${goalDays} days to goal — start dialing back intensity if not already tapering.`
  }
  if (trainingPlan?.weeklyEmphasis) {
    detail += ` Plan emphasis: ${trainingPlan.weeklyEmphasis}.`
  }

  return makeEvent('taper_window', anchorDate, dayOffset, title, detail, 92)
}

function candidatePeakWindow(input: TimelineEngineInput): TimelineEvent | null {
  const { anchorDate, readiness, memory, periodization, trainingPlan } = input
  const phasePeak = periodization?.phase === 'peak'
  const readinessPeak = readiness?.status === 'peak'
  const memoryPeak = memory?.latest?.decision === 'peak'
  const qualitySessions =
    trainingPlan?.week?.filter((s) => s.sessionType === 'tempo' || s.sessionType === 'interval').length ?? 0

  if (!phasePeak && !readinessPeak && !memoryPeak && qualitySessions < 2) return null

  const seed = `peak:${periodization?.phase ?? ''}:${readiness?.status ?? ''}:${memory?.latest?.date ?? ''}`
  const dayOffset = projectDayOffsetInHorizon(seed, 10, 22)

  const title = 'Peak performance window'
  let detail =
    'Signals align for quality work — schedule key sessions while fatigue stays controlled.'
  if (readinessPeak) {
    detail = `Readiness is peak (${readiness.score}) — good window for race-specific work.`
  } else if (memoryPeak && memory?.latest) {
    detail = `Recent coach memory suggests peak block (${memory.latest.confidence} confidence).`
  } else if (phasePeak) {
    detail = 'Training phase is peak — prioritize race-pace reps and recovery around them.'
  }
  if (trainingPlan?.weeklyEmphasis) {
    detail += ` Weekly emphasis: ${trainingPlan.weeklyEmphasis}.`
  }

  return makeEvent('peak_window', anchorDate, dayOffset, title, detail, 86)
}

function candidateFatigueRisk(input: TimelineEngineInput): TimelineEvent | null {
  const { anchorDate, loadControl, fatigue, simulation } = input
  const highLoad = loadControl?.riskLevel === 'high'
  const highFatigue = fatigue?.level === 'high'
  const highFade = simulation?.fadeRisk === 'high'

  if (!highLoad && !highFatigue && !highFade) return null

  const severity =
    (highLoad ? 1 : 0) + (highFatigue ? 1 : 0) + (highFade ? 1 : 0)
  const base = TIMELINE_MIN_HORIZON_DAYS + (3 - Math.min(3, severity)) * 3
  const dayOffset = clampHorizonDayOffset(
    projectDayOffsetInHorizon(
      `fatigue:${loadControl?.riskLevel ?? ''}:${fatigue?.level ?? ''}:${simulation?.fadeRisk ?? ''}`,
      base,
      TIMELINE_MIN_HORIZON_DAYS + 12
    )
  )

  const title = 'Fatigue / fade risk window'
  const parts: string[] = []
  if (highLoad) parts.push('load risk is high')
  if (highFatigue) parts.push('fatigue is elevated')
  if (highFade) parts.push('race simulation shows fade risk')
  const detail = `Next weeks: ${parts.join('; ')} — bias recovery and hold volume steady.`

  return makeEvent('fatigue_risk', anchorDate, dayOffset, title, detail, 88)
}

function candidatePerformanceProjection(input: TimelineEngineInput): TimelineEvent | null {
  const { anchorDate, prediction, goalProgress, simulation } = input
  if (!prediction) return null

  const improving = prediction.direction === 'improving'
  const confident = prediction.confidence >= 0.45
  const ahead = goalProgress?.status === 'ahead'

  if (!((improving && confident) || (ahead && improving))) return null

  const dayOffset = projectDayOffsetInHorizon(
    `perf:${prediction.projectedKps28d.toFixed(2)}:${goalProgress?.status ?? 'na'}`,
    12,
    TIMELINE_MAX_HORIZON_DAYS
  )

  const delta = prediction.projectedKps28d - prediction.projectedKps7d
  const title = 'Performance projection'
  let detail = `KPS outlook (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} vs 7d toward 28d) — stay consistent for ${TIMELINE_MIN_HORIZON_DAYS}–${TIMELINE_MAX_HORIZON_DAYS} day gains.`
  if (simulation) {
    detail += ` Race simulation fade risk: ${simulation.fadeRisk}.`
  }

  return makeEvent('performance_projection', anchorDate, dayOffset, title, detail, 74)
}

function candidateReadinessShift(input: TimelineEngineInput): TimelineEvent | null {
  const { anchorDate, readiness, prediction, periodization, trainingPlan } = input
  if (!periodization) return null

  const phaseShiftSoon = periodization.weeksRemaining <= 3 && periodization.nextPhase != null
  const buildingOrRecovery =
    readiness != null &&
    (readiness.status === 'building' || readiness.status === 'recovery')
  const trendSignal = prediction != null && prediction.direction !== 'unknown'

  if (!phaseShiftSoon && !(buildingOrRecovery && trendSignal)) return null

  const seed = `shift:${readiness?.status ?? 'na'}:${periodization.phase}:${periodization.nextPhase ?? 'none'}`
  const dayOffset = projectDayOffsetInHorizon(seed, TIMELINE_MIN_HORIZON_DAYS, 20)

  const title = 'Readiness shift expected'
  let detail = 'Training phase and signals suggest readiness will move — watch fatigue and easy days.'
  if (phaseShiftSoon && periodization.nextPhase) {
    detail = `Phase may move toward ${periodization.nextPhase} within ~${periodization.weeksRemaining}w — adjust volume as readiness evolves.`
  } else if (readiness && prediction) {
    detail = `Readiness is ${readiness.status} while prediction is ${prediction.direction} — expect form to adjust over the next few weeks.`
  }
  if (trainingPlan?.today?.sessionType) {
    detail += ` Today’s plan: ${trainingPlan.today.sessionType}.`
  }

  return makeEvent('readiness_shift', anchorDate, dayOffset, title, detail, 72)
}

function dedupeAndTakeTop(events: TimelineEvent[]): TimelineEvent[] {
  const byType = new Map<TimelineEventType, TimelineEvent>()
  for (const e of events) {
    const prev = byType.get(e.type)
    if (!prev || e.priority > prev.priority || (e.priority === prev.priority && e.dayOffset < prev.dayOffset)) {
      byType.set(e.type, e)
    }
  }
  const merged = [...byType.values()]
  merged.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset
    return a.type.localeCompare(b.type)
  })
  return merged.slice(0, MAX_EVENTS)
}

export function computeCoachingTimeline(input: TimelineEngineInput): TimelineEngineResult {
  const anchor = input.anchorDate
  const candidates: TimelineEvent[] = []

  const t1 = candidateTaperWindow(input)
  if (t1) candidates.push(t1)
  const t2 = candidatePeakWindow(input)
  if (t2) candidates.push(t2)
  const t3 = candidateFatigueRisk(input)
  if (t3) candidates.push(t3)
  const t4 = candidatePerformanceProjection(input)
  if (t4) candidates.push(t4)
  const t5 = candidateReadinessShift(input)
  if (t5) candidates.push(t5)

  const events = dedupeAndTakeTop(candidates)

  return {
    projection: {
      anchorDate: addDaysIsoDate(anchor, 0),
      minHorizonDays: TIMELINE_MIN_HORIZON_DAYS,
      maxHorizonDays: TIMELINE_MAX_HORIZON_DAYS,
    },
    events,
  }
}
