/**
 * Deterministic Help Center fallback — static guidance when RAG retrieval is missing, empty, or weak.
 * Not AI-generated; not from the curated KB.
 */

import type { HelpSupportAiOutcome } from './helpCenterSupportAi'
import type { SupportKBQueryOutcome, SupportKBResultItem } from './supportRagClient'

/** Below this best-match similarity, retrieval is treated as not useful enough (cosine-style score from client). */
export const MIN_USEFUL_SIMILARITY = 0.15

/** Below this best-match similarity, Help Center may propose AI-controlled escalation (after confirmation). */
export const ESCALATION_CONFIDENCE_THRESHOLD = 0.35

export type HelpTopicId = 'sync' | 'import' | 'kps' | 'general'

export const DETERMINISTIC_FALLBACK_DISCLAIMER =
  'Deterministic fallback: fixed tips in the app when the curated support search cannot return a strong match. This is not an AI answer.'

/**
 * Infer a coarse topic from the user query for topic-keyed fallback bullets.
 */
export function inferHelpTopicFromQuery(query: string): HelpTopicId {
  const q = query.toLowerCase()
  if (
    /\bstrava\b|withings|oauth|redirect|connect|sync|token/.test(q) ||
    (/\bscale\b/.test(q) && /weight|withings/.test(q))
  ) {
    return 'sync'
  }
  if (/\bgarmin\b|\bfit\b|\.fit|import|zip|activity|upload/.test(q)) {
    return 'import'
  }
  if (/\bkps\b|chart|performance|npi|pace|dashboard|menu|history/.test(q)) {
    return 'kps'
  }
  return 'general'
}

export interface FallbackSection {
  id: string
  title: string
  bullets: string[]
}

/**
 * Structured deterministic sections for the support search area (retrieval + fallback slice).
 */
export function getDeterministicFallbackSections(query: string): FallbackSection[] {
  const topic = inferHelpTopicFromQuery(query)
  const sections: FallbackSection[] = []

  if (topic === 'sync') {
    sections.push({
      id: 'sync',
      title: 'Connections (Strava / Withings)',
      bullets: [
        'Open Settings and use the OAuth flow for Strava or Withings.',
        'Production builds need the redirect URL allowlisted in the provider dashboard (see deployment docs).',
        'After connecting, wait for sync or refresh; check browser console only if something still fails.',
      ],
    })
  } else if (topic === 'import') {
    sections.push({
      id: 'import',
      title: 'Imports (Garmin / FIT)',
      bullets: [
        'Use Settings to import a Garmin ZIP or a single .FIT file when supported.',
        'If import says no supported data, try a different export or a single running activity file.',
      ],
    })
  } else if (topic === 'kps') {
    sections.push({
      id: 'kps',
      title: 'KPS and charts',
      bullets: [
        'KPS (Kinetix Performance Score) uses your profile weight and run data — check Settings for weight source.',
        'Charts live under Charts in the nav; History lists individual runs.',
      ],
    })
  }

  sections.push({
    id: 'everywhere',
    title: 'Always try',
    bullets: [
      'Coach chat for run-specific coaching (uses your run context, not the support KB).',
      'Settings for integrations, imports, and targets.',
      'If this search still does not fix it, use Still not resolved — escalation is offered only after two unsuccessful attempts, and a ticket is sent only if you confirm.',
    ],
  })

  return sections
}

/**
 * True when we should show deterministic fallback: no results, or best match weaker than threshold.
 */
export function isWeakOrEmptyRetrieval(results: SupportKBResultItem[]): boolean {
  if (results.length === 0) return true
  const sims = results.map((r) => (typeof r.similarity === 'number' ? r.similarity : 0))
  const best = Math.max(...sims, 0)
  return best < MIN_USEFUL_SIMILARITY
}

export function getBestSupportSimilarity(results: SupportKBResultItem[]): number | null {
  if (results.length === 0) return null
  const sims = results.map((r) => (typeof r.similarity === 'number' ? r.similarity : 0))
  return Math.max(...sims, 0)
}

/**
 * True when the combined KB + support-AI cycle is unresolved for escalation counting.
 * Uses: bad/weak/empty retrieval OR failed/empty AI answer (user "still not resolved" is tracked separately).
 */
export function isHelpSupportSearchCycleUnresolved(
  supportOutcome: SupportKBQueryOutcome,
  bestSimilarity: number | null,
  aiOutcome: HelpSupportAiOutcome | null,
): boolean {
  if (isUnresolvedRetrievalOutcome(supportOutcome, bestSimilarity)) return true
  if (!aiOutcome) return true
  if (aiOutcome.ok === false) return true
  return !aiOutcome.text.trim()
}

/**
 * Hybrid gate: escalation is offered only after two "still not resolved" clicks
 * OR two completed support searches that each ended unresolved (session counters).
 */
export function hybridHelpEscalationGateMet(input: {
  stillNotResolvedClicks: number
  unresolvedCompletedSearchCount: number
}): boolean {
  return input.stillNotResolvedClicks >= 2 || input.unresolvedCompletedSearchCount >= 2
}

/**
 * Whether the Help Center should show the escalation proposal (before confirm-before-ticket).
 * Requires a completed support outcome and the hybrid two-attempt gate.
 */
export function shouldProposeHelpEscalation(input: {
  supportOutcome: SupportKBQueryOutcome | null
  stillNotResolvedClicks: number
  unresolvedCompletedSearchCount: number
}): boolean {
  if (!input.supportOutcome) return false
  return hybridHelpEscalationGateMet({
    stillNotResolvedClicks: input.stillNotResolvedClicks,
    unresolvedCompletedSearchCount: input.unresolvedCompletedSearchCount,
  })
}

/**
 * True when retrieval is unresolved (error, empty, weak, or below escalation confidence).
 * Used to reset escalation-dismiss state only after a new query or a new unresolved retrieval.
 */
export function isUnresolvedRetrievalOutcome(
  outcome: SupportKBQueryOutcome,
  bestSimilarity: number | null,
): boolean {
  if (outcome.ok === false) return true
  if (outcome.data.results.length === 0) return true
  if (isWeakOrEmptyRetrieval(outcome.data.results)) return true
  if (bestSimilarity !== null && bestSimilarity < ESCALATION_CONFIDENCE_THRESHOLD) return true
  return false
}
