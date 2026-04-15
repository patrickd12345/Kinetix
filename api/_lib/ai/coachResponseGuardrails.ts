import {
  collectContractTrustedValueTokens,
  collectTrustedValueTokens,
  extractNumericTokensFromText,
  extractUnitTokensFromText,
  type AdviceConfidence,
  type CoachGuardrailPayload,
  type GuardrailTemplateKind,
  type VerifiedMathResult,
} from '@kinetix/core'

const COACH_GUARDRAIL_SYSTEM_SUPPLEMENT = `FACT SAFETY (mandatory): verified_math_result and verified facts are authoritative. Do not alter trusted values. Do not introduce new numbers, derived numeric targets, diagnoses, predictions, trend claims, ranking claims, or unsupported physiology claims. Use verified facts only for truth claims. The model may explain, summarize, compare, encourage, and give cautious next-step suggestions when clearly hedged. If a safe answer cannot be produced, choose the constrained fallback.`

const BLOCKED_PATTERNS: Array<{ reason: string; re: RegExp }> = [
  { reason: 'unsupported_prediction', re: /\b(?:you will|you'll|likely run|likely hit|predict|prediction|soon|next week)\b/i },
  { reason: 'future_performance_prediction', re: /\b(?:future performance|reach your pb soon|improve next week)\b/i },
  { reason: 'medical_diagnosis', re: /\b(?:diagnos(?:is|e)|medical|injur(?:y|ed)|overtrain(?:ed|ing))\b/i },
  { reason: 'physiological_claim', re: /\b(?:vo2\s*max|aerobic base|threshold pace|lactate threshold|fatigued?|physiolog(?:y|ical)|dehydrated)\b/i },
  { reason: 'training_effect_prediction', re: /\b(?:this run improves|this will improve|training effect|adaptation)\b/i },
  { reason: 'performance_ranking_claim', re: /\b(?:one of your best|best run|top run|top performance|strong performance)\b/i },
  { reason: 'trend_claim', re: /\b(?:pace trend|trending|trend is|over time)\b/i },
  { reason: 'improvement_claim', re: /\b(?:show progress|you're improving|you are improving|get(?:ting)? better)\b/i },
  { reason: 'regression_claim', re: /\b(?:regressing|declining|getting worse|pace trend is downward)\b/i },
  { reason: 'unsupported_causal', re: /\b(?:this proves|proves that|caused by|because of|due to|therefore)\b/i },
]

const HEDGED_SUGGESTION_RE =
  /\b(?:may|might|could|consider|try|you can|it may help|you may want|you might want)\b/i
const STRONG_ADVICE_RE = /\b(?:must|need to|should|definitely|clearly)\b/i
const NUMERIC_TARGET_RE =
  /\b(?:aim for|target|shoot for|goal pace|try for|under|sub-)\b/i

export interface CoachGuardrailOutcome {
  text: string
  fallbackReason: string | null
  templateKind: GuardrailTemplateKind
}

interface ApplyCoachGuardrailsInput {
  draftText: string
  userContent: string
  unitSystem?: 'metric' | 'imperial'
  guardrails: CoachGuardrailPayload
  verifiedMathResult?: VerifiedMathResult | null
}

interface SegmentReview {
  text: string
  confidence: AdviceConfidence
  blockedReason?: string
}

export function isCoachGuardrailPayload(value: unknown): value is CoachGuardrailPayload {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { mode?: unknown }).mode === 'coach' &&
    !!(value as { contract?: unknown }).contract
  )
}

export function buildCoachGuardrailSystemAppendix(guardrails: CoachGuardrailPayload): string {
  return `${COACH_GUARDRAIL_SYSTEM_SUPPLEMENT}\n\nverified_fact_contract (do not alter values; use only as support):\n${JSON.stringify(
    guardrails.contract,
    null,
    2,
  )}`
}

export function renderCoachFailClosedMathResponse(
  result: VerifiedMathResult,
  reply: string,
): string {
  const missing = formatMissingInputs(result.missingInputs)
  const example = formatMissingExample(result.missingInputs)
  return [
    "I can calculate that, but I'm missing:",
    ...missing.map((item) => `- ${item}`),
    '',
    'Send it as:',
    `- ${example}`,
    '',
    `Note: ${reply.trim()}`,
  ].join('\n')
}

export function applyCoachResponseGuardrails(
  input: ApplyCoachGuardrailsInput,
): CoachGuardrailOutcome {
  const templateKind = selectTemplateKind(input)
  const trustedContractTokens = collectContractTrustedValueTokens(input.guardrails.contract)
  const trustedMathTokens = input.verifiedMathResult
    ? collectTrustedValueTokens(input.verifiedMathResult)
    : { numeric: [], units: [] }
  const trustedUserTokens = collectTrustedValueTokens({ userContent: input.userContent })
  const trustedNumeric = new Set([
    ...trustedContractTokens.numeric,
    ...trustedMathTokens.numeric,
    ...trustedUserTokens.numeric,
  ])
  const trustedUnits = new Set([
    ...trustedContractTokens.units,
    ...trustedMathTokens.units,
    ...trustedUserTokens.units,
  ])

  const segments = splitIntoSegments(input.draftText)
  const reviewed = segments.map((segment) =>
    reviewSegment(segment, trustedNumeric, trustedUnits, input.unitSystem),
  )

  const safeSegments = reviewed
    .filter((segment) => segment.confidence !== 'blocked')
    .map((segment) => segment.text)

  const rendered = renderTemplate(templateKind, {
    safeSegments,
    contract: input.guardrails.contract,
    verifiedMathResult: input.verifiedMathResult ?? null,
  })

  const finalReviews = splitIntoSegments(rendered).map((segment) =>
    reviewSegment(segment, trustedNumeric, trustedUnits, input.unitSystem, true),
  )
  const finalSegments = finalReviews
    .filter((segment) => segment.confidence !== 'blocked')
    .map((segment) => segment.text)

  if (finalSegments.length === 0) {
    return {
      text: renderTemplate('general_coach_safe', {
        safeSegments: [],
        contract: input.guardrails.contract,
        verifiedMathResult: input.verifiedMathResult ?? null,
      }),
      fallbackReason: 'coach_guardrail_fallback',
      templateKind: 'general_coach_safe',
    }
  }

  return {
    text: finalSegments.join('\n\n').trim(),
    fallbackReason:
      safeSegments.length < segments.length || finalSegments.length < finalReviews.length
        ? 'coach_guardrail_stripped'
        : null,
    templateKind,
  }
}

function splitIntoSegments(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function reviewSegment(
  segment: string,
  trustedNumeric: Set<string>,
  trustedUnits: Set<string>,
  unitSystem: 'metric' | 'imperial' | undefined,
  allowTemplateLabels = false,
): SegmentReview {
  if (!segment) {
    return { text: segment, confidence: 'blocked', blockedReason: 'empty' }
  }

  if (allowTemplateLabels && /^(?:Result|What it means|Confidence|Verified facts|Interpretation|Next action|Comparison|Note):$/i.test(segment)) {
    return { text: segment, confidence: 'deterministic' }
  }

  const normalizedNumbers = extractNumericTokensFromText(segment)
  const missingNumbers = normalizedNumbers.filter((token) => !trustedNumeric.has(token))
  if (missingNumbers.length > 0) {
    return { text: segment, confidence: 'blocked', blockedReason: 'introduce_new_numeric_value' }
  }

  if (NUMERIC_TARGET_RE.test(segment) && normalizedNumbers.length > 0) {
    return { text: segment, confidence: 'blocked', blockedReason: 'derive_new_numeric_target' }
  }

  if (hasLikelyUnitMismatch(segment, trustedUnits, unitSystem)) {
    return { text: segment, confidence: 'blocked', blockedReason: 'unit_mismatch' }
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.re.test(segment)) {
      return { text: segment, confidence: 'blocked', blockedReason: pattern.reason }
    }
  }

  if (STRONG_ADVICE_RE.test(segment) && !HEDGED_SUGGESTION_RE.test(segment)) {
    return { text: segment, confidence: 'blocked', blockedReason: 'unsupported_strong_advice' }
  }

  if (HEDGED_SUGGESTION_RE.test(segment)) {
    return { text: segment, confidence: 'heuristic' }
  }

  if (normalizedNumbers.length > 0 || /\b(?:verified|based on|compared with|slower than|faster than)\b/i.test(segment)) {
    return { text: segment, confidence: 'supported' }
  }

  return { text: segment, confidence: 'deterministic' }
}

function hasLikelyUnitMismatch(
  segment: string,
  trustedUnits: Set<string>,
  unitSystem: 'metric' | 'imperial' | undefined,
): boolean {
  const segmentUnits = extractUnitTokensFromText(segment)
  if (segmentUnits.length === 0) return false

  if (unitSystem === 'metric' && segmentUnits.some((unit) => unit.includes('mi'))) {
    return !trustedUnits.has('/mi') && !trustedUnits.has('mi')
  }

  if (unitSystem === 'imperial' && segmentUnits.some((unit) => unit.includes('km'))) {
    return !trustedUnits.has('/km') && !trustedUnits.has('km')
  }

  return false
}

function selectTemplateKind(input: ApplyCoachGuardrailsInput): GuardrailTemplateKind {
  if (input.verifiedMathResult) {
    return 'verified_math'
  }

  if (
    input.guardrails.templateHint &&
    input.guardrails.templateHint !== 'auto'
  ) {
    return input.guardrails.templateHint
  }

  const availability = (input.guardrails.contract.verifiedFacts.dataAvailability ?? {}) as {
    hasRetrievedRuns?: boolean
    hasPbTargets?: boolean
  }

  if (!availability.hasRetrievedRuns && !availability.hasPbTargets) {
    return 'insufficient_data'
  }

  if (/\b(?:compare|comparison|versus|vs\.?|than)\b/i.test(input.userContent)) {
    return 'comparison'
  }

  if (availability.hasRetrievedRuns || availability.hasPbTargets) {
    return 'verified_run_analysis'
  }

  return 'general_coach_safe'
}

function renderTemplate(
  templateKind: GuardrailTemplateKind,
  input: {
    safeSegments: string[]
    contract: CoachGuardrailPayload['contract']
    verifiedMathResult: VerifiedMathResult | null
  },
): string {
  switch (templateKind) {
    case 'verified_math':
      return renderVerifiedMathTemplate(input.verifiedMathResult, input.safeSegments)
    case 'comparison':
      return renderVerifiedFactTemplate('Comparison', input.contract, input.safeSegments)
    case 'verified_run_analysis':
      return renderVerifiedFactTemplate('Interpretation', input.contract, input.safeSegments)
    case 'insufficient_data':
      return renderInsufficientDataTemplate()
    case 'general_coach_safe':
      return renderGeneralFallbackTemplate(input.safeSegments)
    case 'fail_closed_math':
      return renderGeneralFallbackTemplate(input.safeSegments)
    default:
      return renderGeneralFallbackTemplate(input.safeSegments)
  }
}

function renderVerifiedMathTemplate(
  result: VerifiedMathResult | null,
  safeSegments: string[],
): string {
  const resultLine = result ? pickVerifiedMathDisplay(result) : 'Verified calculation available.'
  const explanation = safeSegments[0] ?? result?.formatted.narrative ?? 'These values come from the Kinetix calculator.'
  return [
    'Result:',
    resultLine,
    '',
    'What it means:',
    explanation,
    '',
    'Confidence:',
    'Verified by Kinetix calculator.',
  ].join('\n')
}

function renderVerifiedFactTemplate(
  interpretationLabel: 'Interpretation' | 'Comparison',
  contract: CoachGuardrailPayload['contract'],
  safeSegments: string[],
): string {
  const factLines = buildVerifiedFactLines(contract)
  const interpretation = pickInterpretation(safeSegments)
  const nextAction = pickNextAction(safeSegments)
  return [
    'Verified facts:',
    ...factLines.map((line) => `- ${line}`),
    '',
    `${interpretationLabel}:`,
    interpretation,
    '',
    'Next action:',
    nextAction,
  ].join('\n')
}

function renderInsufficientDataTemplate(): string {
  return [
    'I can help explain verified running data, but I do not have enough trusted facts to answer that safely.',
    '',
    'Share:',
    '- an exact run distance and duration',
    '- or two specific runs to compare',
  ].join('\n')
}

function renderGeneralFallbackTemplate(safeSegments: string[]): string {
  const best = safeSegments[0]
  if (best) return best
  return [
    'I can explain verified running facts and offer cautious next steps, but I cannot support a stronger answer from the trusted data I have.',
    'Share an exact run distance, duration, or a specific run comparison for a safer answer.',
  ].join('\n\n')
}

function buildVerifiedFactLines(contract: CoachGuardrailPayload['contract']): string[] {
  const facts = contract.verifiedFacts as {
    retrievedRunCount?: number
    retrievedRuns?: Array<{
      distanceDisplay?: string | null
      paceDisplay?: string | null
      kps?: number | null
      date?: string | null
    }>
    pbPaceToBeat?: { fiveKDisplay?: string; tenKDisplay?: string } | null
  }

  const lines: string[] = []
  if (typeof facts.retrievedRunCount === 'number' && facts.retrievedRunCount > 0) {
    lines.push(`Retrieved runs available: ${facts.retrievedRunCount}.`)
  }

  for (const run of (facts.retrievedRuns ?? []).slice(0, 2)) {
    const parts = [run.distanceDisplay, run.paceDisplay ? `at ${run.paceDisplay}` : null]
      .filter(Boolean)
      .join(' ')
    const withKps = run.kps != null ? `${parts}, KPS ${run.kps}.` : `${parts}.`
    lines.push(withKps.trim())
  }

  if (facts.pbPaceToBeat?.fiveKDisplay || facts.pbPaceToBeat?.tenKDisplay) {
    lines.push(
      `PB pace to beat: 5K under ${facts.pbPaceToBeat?.fiveKDisplay ?? '?'}, 10K under ${facts.pbPaceToBeat?.tenKDisplay ?? '?'}.`,
    )
  }

  if (lines.length === 0) {
    lines.push('Trusted running facts are limited for this answer.')
  }
  return lines
}

function pickInterpretation(safeSegments: string[]): string {
  return (
    safeSegments.find((segment) => !HEDGED_SUGGESTION_RE.test(segment)) ??
    'The verified facts support only a cautious summary.'
  )
}

function pickNextAction(safeSegments: string[]): string {
  return (
    safeSegments.find((segment) => HEDGED_SUGGESTION_RE.test(segment)) ??
    'You may want an easier next session if you want to keep the advice conservative.'
  )
}

function pickVerifiedMathDisplay(result: VerifiedMathResult): string {
  const preferredKeys = [
    'averagePaceDisplay',
    'paceDisplay',
    'primaryDisplay',
    'timeClock',
    'kps',
    'summary',
    'narrative',
  ]

  for (const key of preferredKeys) {
    const value = result.formatted[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  const firstFormatted = Object.values(result.formatted).find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )
  return firstFormatted?.trim() ?? 'Verified calculation complete.'
}

function formatMissingInputs(missingInputs: string[] | undefined): string[] {
  const values = missingInputs?.length ? missingInputs : ['exact run details']
  return values.map((value) => {
    switch (value) {
      case 'distance_each_segment_m':
        return 'distance for each segment'
      case 'distance_m':
        return 'run distance'
      case 'time_seconds':
        return 'run duration'
      case 'userProfile.age':
        return 'your age'
      case 'userProfile.weightKg':
        return 'your weight'
      case 'clarification':
        return 'a clearer pacing question'
      default:
        return value.replace(/[._]/g, ' ')
    }
  })
}

function formatMissingExample(missingInputs: string[] | undefined): string {
  if (missingInputs?.includes('distance_each_segment_m')) {
    return '5:20/km and 5:45/km over 1 km each'
  }
  if (missingInputs?.includes('userProfile.age') || missingInputs?.includes('userProfile.weightKg')) {
    return 'Compute KPS for 5 km in 25:00 with age 35 and weight 70 kg'
  }
  return '5 km in 25:00'
}
