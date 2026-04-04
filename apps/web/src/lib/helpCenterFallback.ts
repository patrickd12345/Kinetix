/**
 * Deterministic Help Center fallback — static guidance when RAG retrieval is missing, empty, or weak.
 * Not AI-generated; not from the curated KB.
 */

import type { SupportKBResultItem } from './supportRagClient'

/** Below this best-match similarity, retrieval is treated as not useful enough (cosine-style score from client). */
export const MIN_USEFUL_SIMILARITY = 0.15

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
      'Ticket / contact below if something is still blocked after trying the above.',
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
