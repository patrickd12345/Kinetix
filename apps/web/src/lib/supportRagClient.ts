/**
 * Curated support KB client — POST /support/kb/query on the same RAG service as run indexing.
 * Retrieval only; no LLM synthesis here.
 */

import { getRAGBaseUrl } from './ragClient'

export interface SupportKBResultItem {
  chunkId: string
  distance: number | null
  similarity: number | null
  document: string
  metadata: Record<string, string | number | undefined>
}

export interface SupportKBQueryResponse {
  collection: string
  query: string
  topK: number
  filters: { topic: string | null }
  results: SupportKBResultItem[]
}

export type SupportKBQueryFailure =
  | { ok: false; reason: 'unavailable' }
  | { ok: false; reason: 'http_error'; status: number }
  | { ok: false; reason: 'invalid_response' }

export type SupportKBQueryOutcome =
  | { ok: true; data: SupportKBQueryResponse }
  | SupportKBQueryFailure

/**
 * Semantic search over the support knowledge base (kinetix_support_kb).
 */
export async function querySupportKB(
  query: string,
  options: { topK?: number; topic?: string } = {}
): Promise<SupportKBQueryOutcome> {
  const trimmed = query.trim()
  if (!trimmed) {
    return {
      ok: true,
      data: {
        collection: 'kinetix_support_kb',
        query: '',
        topK: 0,
        filters: { topic: null },
        results: [],
      },
    }
  }

  const base = await getRAGBaseUrl()
  if (!base) {
    return { ok: false, reason: 'unavailable' }
  }

  const { topK = 5, topic } = options

  try {
    const res = await fetch(`${base}/support/kb/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: trimmed, topK, ...(topic ? { topic } : {}) }),
      signal: AbortSignal.timeout(15000),
    })

    if (res.status === 503) {
      return { ok: false, reason: 'unavailable' }
    }

    if (!res.ok) {
      return { ok: false, reason: 'http_error', status: res.status }
    }

    const data = (await res.json()) as Partial<SupportKBQueryResponse>
    if (!data || typeof data !== 'object' || !Array.isArray(data.results)) {
      return { ok: false, reason: 'invalid_response' }
    }

    return {
      ok: true,
      data: {
        collection: typeof data.collection === 'string' ? data.collection : 'kinetix_support_kb',
        query: typeof data.query === 'string' ? data.query : trimmed,
        topK: typeof data.topK === 'number' ? data.topK : topK,
        filters: data.filters ?? { topic: topic ?? null },
        results: data.results.map((r) => ({
          chunkId: String(r.chunkId ?? ''),
          distance: r.distance ?? null,
          similarity: r.similarity ?? null,
          document: typeof r.document === 'string' ? r.document : '',
          metadata: (r.metadata && typeof r.metadata === 'object' ? r.metadata : {}) as Record<
            string,
            string | number | undefined
          >,
        })),
      },
    }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

export interface KinetixSupportTicketPayload {
  product: 'kinetix'
  userId: string | null
  timestamp: string
  issueSummary: string
  conversationExcerpt: string
  attemptedSolutions: string
  environment: 'web'
  severity: 'unknown' | 'low' | 'medium' | 'high'
  metadata?: Record<string, unknown>
}

export type CreateSupportTicketResult =
  | { ok: true; ticketId: string; receivedAt: string }
  | { ok: false; reason: 'unavailable' | 'http_error'; status?: number }

/**
 * POST /support/ticket/create on the RAG service — persists structured ticket after user confirms escalation.
 */
export async function createSupportTicket(
  payload: KinetixSupportTicketPayload,
): Promise<CreateSupportTicketResult> {
  const base = await getRAGBaseUrl()
  if (!base) {
    return { ok: false, reason: 'unavailable' }
  }

  try {
    const res = await fetch(`${base}/support/ticket/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    })

    if (res.status === 503) {
      return { ok: false, reason: 'unavailable' }
    }

    if (!res.ok) {
      return { ok: false, reason: 'http_error', status: res.status }
    }

    const data = (await res.json()) as { ticketId?: string; receivedAt?: string }
    const ticketId = typeof data.ticketId === 'string' ? data.ticketId : ''
    const receivedAt = typeof data.receivedAt === 'string' ? data.receivedAt : ''
    if (!ticketId) {
      return { ok: false, reason: 'http_error', status: res.status }
    }
    return { ok: true, ticketId, receivedAt }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}
