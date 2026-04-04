/**
 * Help Center escalation handoff — structured context for email (mailto) or a future ticket API.
 * No server-side ticket persistence in this slice.
 */

import type { HelpTopicId } from './helpCenterFallback'
import { inferHelpTopicFromQuery, isWeakOrEmptyRetrieval } from './helpCenterFallback'
import type { SupportKBQueryOutcome, SupportKBResultItem } from './supportRagClient'

export const ESCALATION_HANDOFF_NOTE =
  'This is not a submitted ticket. Email opens with diagnostic context only; the team will respond out of band.'

export type RetrievalHandoffState =
  | 'service_unavailable'
  | 'query_failed'
  | 'retrieval_empty'
  | 'retrieval_weak'
  /** KB returned at least one chunk above the weak threshold (not an unresolved retrieval path). */
  | 'retrieval_useful'

export interface SurfacedArticleRef {
  chunkId: string
  title: string
  similarity: number | null
}

export interface SupportEscalationPayload {
  product: 'kinetix'
  surface: 'web'
  /** Current page path when the user escalates. */
  route: string
  /** ISO-8601 UTC when the payload was built. */
  timestampUtc: string
  /** Optional opaque user id from auth (no PII beyond what the app already holds). */
  userIdOpaque: string | null
  /** Best-effort app version if configured (VITE_APP_VERSION). */
  appVersion: string | null
  /** User-entered or quick-prompt query text. */
  userQuery: string
  /** Coarse topic inferred from the query (same helper as deterministic fallback). */
  inferredTopic: HelpTopicId
  /** Whether deterministic fallback guidance was shown. */
  fallbackGuidanceShown: boolean
  /** High-level retrieval outcome for triage. */
  retrievalState: RetrievalHandoffState
  /** KB hits shown in the UI (may be empty or weak matches). */
  surfacedArticles: SurfacedArticleRef[]
}

function articleTitle(r: SupportKBResultItem): string {
  const t = r.metadata.title
  if (typeof t === 'string' && t.trim()) return t.trim()
  return r.chunkId || 'Article'
}

/** Maps support query outcome to a handoff label (honest about weak vs useful matches). */
export function retrievalStateForPayload(outcome: SupportKBQueryOutcome): RetrievalHandoffState {
  if (outcome.ok === false) {
    if (outcome.reason === 'unavailable') return 'service_unavailable'
    return 'query_failed'
  }
  const results = outcome.data.results
  if (results.length === 0) return 'retrieval_empty'
  if (isWeakOrEmptyRetrieval(results)) return 'retrieval_weak'
  return 'retrieval_useful'
}

export function buildSurfacedArticles(results: SupportKBResultItem[]): SurfacedArticleRef[] {
  return results.map((r) => ({
    chunkId: r.chunkId,
    title: articleTitle(r),
    similarity: typeof r.similarity === 'number' ? r.similarity : null,
  }))
}

export function buildSupportEscalationPayload(input: {
  userQuery: string
  supportOutcome: SupportKBQueryOutcome
  route: string
  userIdOpaque: string | null
  fallbackGuidanceShown: boolean
}): SupportEscalationPayload {
  const { userQuery, supportOutcome, route, userIdOpaque, fallbackGuidanceShown } = input
  const results = supportOutcome.ok === true ? supportOutcome.data.results : []
  const retrievalState = retrievalStateForPayload(supportOutcome)
  const q = userQuery.trim() || (supportOutcome.ok === true ? supportOutcome.data.query : '')
  const inferredTopic = inferHelpTopicFromQuery(q)
  const appVersion =
    typeof import.meta.env.VITE_APP_VERSION === 'string' && import.meta.env.VITE_APP_VERSION.trim()
      ? import.meta.env.VITE_APP_VERSION.trim()
      : null

  return {
    product: 'kinetix',
    surface: 'web',
    route,
    timestampUtc: new Date().toISOString(),
    userIdOpaque,
    appVersion,
    userQuery: q,
    inferredTopic,
    fallbackGuidanceShown,
    retrievalState,
    surfacedArticles: buildSurfacedArticles(results),
  }
}

/** Plain-text body for mailto or future API — structured, no claim of AI synthesis. */
export function formatEscalationBodyPlain(payload: SupportEscalationPayload): string {
  const lines: string[] = [
    ESCALATION_HANDOFF_NOTE,
    '',
    '---',
    `product: ${payload.product}`,
    `surface: ${payload.surface}`,
    `route: ${payload.route}`,
    `timestamp_utc: ${payload.timestampUtc}`,
    `user_id_opaque: ${payload.userIdOpaque ?? 'not_signed_in'}`,
    `app_version: ${payload.appVersion ?? 'unknown'}`,
    `inferred_topic: ${payload.inferredTopic}`,
    `retrieval_state: ${payload.retrievalState}`,
    `fallback_guidance_shown: ${payload.fallbackGuidanceShown ? 'yes' : 'no'}`,
    `user_query: ${payload.userQuery}`,
    '',
    'surfaced_kb_refs:',
  ]

  if (payload.surfacedArticles.length === 0) {
    lines.push('  (none)')
  } else {
    for (const a of payload.surfacedArticles) {
      const sim = a.similarity === null ? 'n/a' : a.similarity.toFixed(4)
      lines.push(`  - chunk_id=${a.chunkId} | title=${a.title} | similarity=${sim}`)
    }
  }

  lines.push('', '---', 'Please describe what still fails below:', '')

  return lines.join('\n')
}

export function buildEscalationMailtoHref(supportEmail: string, payload: SupportEscalationPayload): string {
  const email = supportEmail.trim()
  const topic = payload.inferredTopic
  const qShort = payload.userQuery.length > 60 ? `${payload.userQuery.slice(0, 57)}…` : payload.userQuery
  const subject = `[Kinetix web] Support — ${topic} — ${qShort || '(no query)'}`
  const body = formatEscalationBodyPlain(payload)
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
