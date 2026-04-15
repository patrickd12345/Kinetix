import { calculateKPS, type RunData, type UserProfile } from '../kps/calculator'
import {
  extractClockDurationSeconds,
  extractFirstDistanceMeters,
  extractPaceTokens,
  formatPaceSecondsPerKm,
  KM_PER_MILE,
  paceSecondsPerKmToSecondsPerMi,
  paceSecondsPerMiToSecondsPerKm,
  parseClockTimeToSeconds,
  parsePaceToken,
} from './parse'
import type { ChatMathContext, VerifiedMathOperation, VerifiedMathResult } from './types'

const MATH_PACE_RE = /\d{1,2}:\d{2}\s*\/\s*(?:km|mi|mile|miles)\b/i

/** Lightweight server-side flag: numeric running math likely present. */
export function isMathBearingMessage(text: string): boolean {
  const t = text.trim()
  if (MATH_PACE_RE.test(t)) return true
  if (/\bKPS\b|kinetix\s+performance\s+score/i.test(t)) return true
  if (/\b(?:pace|pacing)\b/i.test(t) && /\d/.test(t)) return true
  if (/\b(?:convert|conversion)\b.*(?:\/km|\/mi|min\/km|min\/mi)/i.test(t)) return true
  if (/\b(?:average|mean|overall|combined|weighted)\s+(?:pace|split)/i.test(t)) return true
  if (/\b(?:percent|percentage|%)\b.*\b(?:faster|slower|improve|delta)\b/i.test(t)) return true
  if (/\b(?:split|segment)s?\b/i.test(t) && MATH_PACE_RE.test(t)) return true
  return false
}

function fail(
  operation: VerifiedMathOperation,
  inputs: Record<string, unknown>,
  error: string,
  missingInputs?: string[],
): VerifiedMathResult {
  return {
    type: 'verified_math_result',
    operation,
    canAnswer: false,
    inputs,
    outputs: {},
    formatted: {
      safeReply: error,
    },
    error,
    missingInputs,
  }
}

function ok(
  operation: VerifiedMathOperation,
  inputs: Record<string, unknown>,
  outputs: Record<string, unknown>,
  formatted: Record<string, string>,
): VerifiedMathResult {
  return {
    type: 'verified_math_result',
    operation,
    canAnswer: true,
    inputs,
    outputs,
    formatted,
  }
}

function formatPaceForContext(secondsPerKm: number, unitSystem: 'metric' | 'imperial' | undefined): string {
  if (unitSystem === 'imperial') {
    const secMi = paceSecondsPerKmToSecondsPerMi(secondsPerKm)
    return `${formatPaceSecondsPerKm(secMi)}/mi`
  }
  return `${formatPaceSecondsPerKm(secondsPerKm)}/km`
}

/** Extract total time in seconds from free text (first clock-like token that is not part of pace/mm:ss/km). */
function extractDurationSecondsForRun(text: string): number | null {
  const fromPhrases = extractClockDurationSeconds(text)
  if (fromPhrases != null) return fromPhrases
  const m = text.match(
    /\b(?:in|for|time)\s+(\d{1,2}:\d{2}(?::\d{2})?)\b/i,
  )
  if (m) {
    const s = parseClockTimeToSeconds(m[1])
    if (s != null) return s
  }
  const tail = text.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\s*$/m)
  if (tail) {
    const s = parseClockTimeToSeconds(tail[1])
    if (s != null && !/\/\s*(km|mi)/i.test(text.slice(Math.max(0, text.lastIndexOf(tail[1]) - 5), text.lastIndexOf(tail[1]) + 12))) {
      return s
    }
  }
  return null
}

function tryAveragePaceSegments(text: string, ctx: ChatMathContext): VerifiedMathResult | null {
  const tokens = extractPaceTokens(text)
  if (tokens.length < 2) return null

  const needsContext =
    /\baverage\b/i.test(text) ||
    /\boverall\b/i.test(text) ||
    /\bcombined\b/i.test(text) ||
    /\bmean\b/i.test(text) ||
    /\bweighted\b/i.test(text) ||
    /\bsegment/i.test(text) ||
    /\beach\b/i.test(text) ||
    /\btotal\b/i.test(text)

  if (!needsContext) return null

  const eachKm = text.match(/(\d+(?:\.\d+)?)\s*km\s+each\b/i)
  const eachKm2 = text.match(/\beach\s+(\d+(?:\.\d+)?)\s*km\b/i)
  const eachM = text.match(/(\d+(?:\.\d+)?)\s*m\s+each\b/i)

  let metersPerSeg: number | null = null
  if (eachKm) metersPerSeg = Number(eachKm[1]) * 1000
  else if (eachKm2) metersPerSeg = Number(eachKm2[1]) * 1000
  else if (eachM) metersPerSeg = Number(eachM[1])

  if (metersPerSeg == null || !Number.isFinite(metersPerSeg) || metersPerSeg <= 0) {
    return fail(
      'average_pace_segments',
      { paceTokens: tokens.map((t) => t.raw) },
      'Need an explicit distance for each segment (e.g. "1 km each") to compute a distance-weighted average pace.',
      ['distance_each_segment_m'],
    )
  }

  if (tokens.length * metersPerSeg <= 0) {
    return fail('average_pace_segments', {}, 'Invalid segment count or distance.', ['segments'])
  }

  let totalSec = 0
  let totalM = 0
  for (let i = 0; i < tokens.length; i++) {
    const secKm = tokens[i].secondsPerKm
    const distM = metersPerSeg
    totalSec += (secKm / 1000) * distM
    totalM += distM
  }

  const avgSecPerKm = (totalSec / totalM) * 1000
  const paceMetric = `${formatPaceSecondsPerKm(avgSecPerKm)}/km`
  const paceDisplay = formatPaceForContext(avgSecPerKm, ctx.unitSystem)

  return ok(
    'average_pace_segments',
    {
      segmentPacesSecondsPerKm: tokens.map((t) => t.secondsPerKm),
      distanceEachSegmentM: metersPerSeg,
      segmentCount: tokens.length,
    },
    {
      averagePaceSecondsPerKm: avgSecPerKm,
      totalTimeSeconds: totalSec,
      totalDistanceM: totalM,
    },
    {
      averagePaceMetric: paceMetric,
      averagePaceDisplay: paceDisplay,
      narrative: `Distance-weighted average pace is ${paceDisplay} (total time ${totalSec.toFixed(
        1,
      )} s over ${(totalM / 1000).toFixed(3)} km).`,
    },
  )
}

function tryPaceFromTimeDistance(text: string, ctx: ChatMathContext): VerifiedMathResult | null {
  const distM = extractFirstDistanceMeters(text)
  const timeSec = extractDurationSecondsForRun(text)
  if (distM == null || timeSec == null) return null
  if (!/\b(?:pace|pacing|\/km|\/mi)\b/i.test(text) && !/\d{1,2}:\d{2}\s*\/\s*(km|mi)/i.test(text)) {
    if (!/\bwhat\s+(?:is|was)\s+my\s+pace\b/i.test(text) && !/\bpace\b/i.test(text)) return null
  }

  const secPerKm = (timeSec / distM) * 1000
  const paceDisplay = formatPaceForContext(secPerKm, ctx.unitSystem)

  return ok(
    'pace_from_time_distance',
    { distanceM: distM, timeSeconds: timeSec },
    { paceSecondsPerKm: secPerKm },
    {
      paceDisplay,
      narrative: `Average pace is ${paceDisplay}.`,
    },
  )
}

function tryTimeFromPaceDistance(text: string, ctx: ChatMathContext): VerifiedMathResult | null {
  const distM = extractFirstDistanceMeters(text)
  if (distM == null) return null
  const paceTok = text.match(MATH_PACE_RE)
  if (!paceTok) return null
  const parsed = parsePaceToken(paceTok[0])
  if (!parsed) return null

  if (!/\b(?:time|how long|duration)\b/i.test(text) && !/\b(?:at|for)\s+\d/.test(text)) {
    return null
  }

  const secPerKm = parsed.unit === 'km' ? parsed.secondsPerUnit : paceSecondsPerMiToSecondsPerKm(parsed.secondsPerUnit)
  const timeSeconds = (secPerKm / 1000) * distM
  const paceDisplay = formatPaceForContext(secPerKm, ctx.unitSystem)

  return ok(
    'time_from_pace_distance',
    { distanceM: distM, paceSecondsPerKm: secPerKm },
    { timeSeconds },
    {
      timeClock: formatClock(timeSeconds),
      paceUsed: paceDisplay,
      narrative: `At ${paceDisplay}, ${(distM / 1000).toFixed(3)} km takes about ${formatClock(timeSeconds)}.`,
    },
  )
}

function formatClock(totalSeconds: number): string {
  const s = Math.round(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

function tryConvertPace(text: string, ctx: ChatMathContext): VerifiedMathResult | null {
  if (!/\b(?:convert|conversion|to\s+min\/|\/km|\/mi)\b/i.test(text)) return null
  const tokens = extractPaceTokens(text)
  if (tokens.length !== 1) return null
  const rawMatch = text.match(MATH_PACE_RE)
  if (!rawMatch) return null
  const parsed = parsePaceToken(rawMatch[0])
  if (!parsed) return null

  const secKm = parsed.unit === 'km' ? parsed.secondsPerUnit : paceSecondsPerMiToSecondsPerKm(parsed.secondsPerUnit)
  const secMi = paceSecondsPerKmToSecondsPerMi(secKm)

  const toMetric = /\bto\s+(?:min\/)?km\b/i.test(text) || /\bper\s+km\b/i.test(text)
  const toImperial = /\bto\s+(?:min\/)?mi\b/i.test(text) || /\bper\s+mi\b/i.test(text) || /\bmile\b/i.test(text)

  let primaryDisplay: string
  if (parsed.unit === 'km' && (toImperial || ctx.unitSystem === 'imperial')) {
    primaryDisplay = `${formatPaceSecondsPerKm(secMi)}/mi`
  } else if (parsed.unit === 'mi' && (toMetric || ctx.unitSystem === 'metric')) {
    primaryDisplay = `${formatPaceSecondsPerKm(secKm)}/km`
  } else {
    primaryDisplay =
      ctx.unitSystem === 'imperial'
        ? `${formatPaceSecondsPerKm(secMi)}/mi`
        : `${formatPaceSecondsPerKm(secKm)}/km`
  }

  return ok(
    parsed.unit === 'km' ? 'convert_pace_km_mi' : 'convert_pace_mi_km',
    { inputPace: rawMatch[0] },
    { paceSecondsPerKm: secKm, paceSecondsPerMi: secMi },
    {
      pacePerKm: `${formatPaceSecondsPerKm(secKm)}/km`,
      pacePerMi: `${formatPaceSecondsPerKm(secMi)}/mi`,
      primaryDisplay,
      narrative: `Same effort: ${formatPaceSecondsPerKm(secKm)}/km = ${formatPaceSecondsPerKm(secMi)}/mi (1 mi = ${KM_PER_MILE} km).`,
    },
  )
}

function tryKps(text: string, ctx: ChatMathContext): VerifiedMathResult | null {
  if (!/\bKPS\b|kinetix\s+performance/i.test(text)) return null
  const profile = ctx.userProfile
  if (!profile || profile.age <= 0 || profile.weightKg <= 0) {
    return fail(
      'kps_from_distance_time',
      {},
      'Need age and weight on the profile to compute KPS.',
      ['userProfile.age', 'userProfile.weightKg'],
    )
  }

  const distM = extractFirstDistanceMeters(text)
  const timeSec = extractDurationSecondsForRun(text)
  if (distM == null || timeSec == null) {
    return fail(
      'kps_from_distance_time',
      {},
      'Need a distance (e.g. 5 km) and a duration (e.g. 25:00) to compute KPS.',
      ['distance_m', 'time_seconds'],
    )
  }

  const distanceKmMetric = distM / 1000
  const imperialDist = /\b(\d+(?:\.\d+)?)\s*(?:mi|mile|miles)\b/i.test(text)
  const runUnit: RunData['unit'] = imperialDist ? 'imperial' : 'metric'
  const run: RunData = imperialDist
    ? { distanceKm: distanceKmMetric / 1.60934, timeSeconds: timeSec, unit: 'imperial' }
    : { distanceKm: distanceKmMetric, timeSeconds: timeSec, unit: 'metric' }

  const kps = calculateKPS(run, profile as UserProfile)
  return ok(
    'kps_from_distance_time',
    { distanceM: distM, timeSeconds: timeSec, unit: runUnit },
    { kps },
    {
      kps: kps.toFixed(2),
      narrative: `Verified KPS (canonical formula) ≈ ${kps.toFixed(2)} for that run.`,
    },
  )
}

function tryPercentDelta(text: string): VerifiedMathResult | null {
  const tokens = extractPaceTokens(text)
  if (tokens.length < 2) return null
  if (!/\b(?:percent|percentage|%|faster|slower|delta|improve)\b/i.test(text)) return null

  const a = tokens[0].secondsPerKm
  const b = tokens[tokens.length - 1].secondsPerKm
  if (a <= 0 || b <= 0) return fail('percent_delta', {}, 'Invalid pace values.', undefined)

  const pct = ((a - b) / a) * 100
  const faster = b < a

  return ok(
    'percent_delta',
    { paceASecondsPerKm: a, paceBSecondsPerKm: b },
    { percentChangeVersusFirst: pct, fasterSecondVersusFirst: faster },
    {
      summary: `${faster ? 'Second pace is' : 'Second pace is not'} faster than the first by about ${Math.abs(pct).toFixed(1)}% (by time per km).`,
    },
  )
}

/**
 * If the message is math-bearing, returns a structured verified result (may be canAnswer: false).
 * If not math-bearing, returns null so the caller can use the normal LLM path.
 */
export function tryComputeVerifiedMath(message: string, ctx: ChatMathContext): VerifiedMathResult | null {
  const t = message.trim()
  if (!isMathBearingMessage(t)) return null

  const attempts: Array<() => VerifiedMathResult | null> = [
    () => tryAveragePaceSegments(t, ctx),
    () => tryConvertPace(t, ctx),
    () => tryKps(t, ctx),
    () => tryPercentDelta(t),
    () => tryPaceFromTimeDistance(t, ctx),
    () => tryTimeFromPaceDistance(t, ctx),
  ]

  for (const run of attempts) {
    const r = run()
    if (r != null) return r
  }

  return fail(
    'unknown',
    { text: t },
    'That looks like a pacing or score question, but there is not enough unambiguous data to compute it deterministically. Ask for a specific distance, duration, or each segment distance.',
    ['clarification'],
  )
}

/** JSON block appended to the system prompt for explain-only LLM use. */
export function formatVerifiedMathForPrompt(result: VerifiedMathResult): string {
  return [
    'verified_math_result (do not alter numbers; explain only):',
    JSON.stringify(
      {
        operation: result.operation,
        canAnswer: result.canAnswer,
        inputs: result.inputs,
        outputs: result.outputs,
        formatted: result.formatted,
        error: result.error,
        missingInputs: result.missingInputs,
      },
      null,
      2,
    ),
  ].join('\n')
}
