/**
 * Persists AI-confirmed Kinetix support tickets to Supabase (canonical store).
 * Operational records only — not curated knowledge.
 *
 * DO NOT auto-ingest tickets into curated support RAG.
 * Reinjection must be curated and manual.
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { resolveKinetixRuntimeEnvFromObject } from '../../../api/_lib/env/runtime.shared.mjs';

const SEVERITY_ALLOWED = new Set(['unknown', 'low', 'medium', 'high', 'critical']);

/**
 * Deterministic, human-readable id: kinetix-YYYYMMDD-<6 hex chars>
 * Example: kinetix-20260404-8f3a2c
 */
export function generateKinetixTicketId() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const suffix = randomBytes(3).toString('hex');
  return `kinetix-${y}${m}${day}-${suffix}`;
}

/**
 * @param {string} raw
 * @returns {unknown[]}
 */
function stringFieldToJsonbArray(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p;
    if (p && typeof p === 'object') return [p];
  } catch {
    /* plain text */
  }
  return [{ text: raw }];
}

/**
 * @param {string | undefined} sev
 */
function normalizeSeverity(sev) {
  if (typeof sev !== 'string' || !sev.trim()) return 'unknown';
  const s = sev.trim().toLowerCase();
  return SEVERITY_ALLOWED.has(s) ? s : 'unknown';
}

/**
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSupabaseServiceClient() {
  const env = resolveKinetixRuntimeEnvFromObject();
  const url = env.supabaseUrl;
  const key = env.supabaseServiceRoleKey;
  if (!url || !key) {
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * @param {Record<string, unknown>} raw
 * @returns {{ ok: true, value: Record<string, unknown> } | { ok: false, error: string }}
 */
export function validateSupportTicketBody(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const product = raw.product;
  if (product !== 'kinetix') {
    return { ok: false, error: 'product must be "kinetix"' };
  }
  const timestamp = raw.timestamp;
  if (typeof timestamp !== 'string' || !timestamp.trim()) {
    return { ok: false, error: 'timestamp is required (ISO string)' };
  }
  const issueSummary = raw.issueSummary;
  if (typeof issueSummary !== 'string' || !issueSummary.trim()) {
    return { ok: false, error: 'issueSummary is required' };
  }
  const environment = raw.environment;
  if (environment !== 'web') {
    return { ok: false, error: 'environment must be "web"' };
  }
  const severity = raw.severity;
  if (severity != null && typeof severity !== 'string') {
    return { ok: false, error: 'severity must be a string if present' };
  }

  const userId =
    raw.userId === null || raw.userId === undefined
      ? null
      : typeof raw.userId === 'string'
        ? raw.userId
        : String(raw.userId);

  const value = {
    product,
    timestamp: timestamp.trim(),
    issueSummary: issueSummary.trim(),
    environment,
    severity: typeof severity === 'string' && severity.trim() ? severity.trim() : 'unknown',
    userId,
    conversationExcerpt:
      typeof raw.conversationExcerpt === 'string' ? raw.conversationExcerpt : JSON.stringify(raw.conversationExcerpt ?? ''),
    attemptedSolutions:
      typeof raw.attemptedSolutions === 'string' ? raw.attemptedSolutions : JSON.stringify(raw.attemptedSolutions ?? ''),
  };
  return { ok: true, value };
}

/**
 * @param {Record<string, unknown>} validatedValue from validateSupportTicketBody
 * @param {string} ticketId external id (generateKinetixTicketId)
 * @param {string} receivedAt ISO
 */
export function buildSupportTicketRow(validatedValue, ticketId, receivedAt) {
  const severity = normalizeSeverity(validatedValue.severity);
  return {
    ticket_id: ticketId,
    product_key: 'kinetix',
    user_id: validatedValue.userId,
    created_at: receivedAt,
    updated_at: receivedAt,
    status: 'open',
    severity,
    environment: validatedValue.environment ?? null,
    issue_summary: validatedValue.issueSummary,
    conversation_excerpt: stringFieldToJsonbArray(validatedValue.conversationExcerpt),
    attempted_solutions: stringFieldToJsonbArray(validatedValue.attemptedSolutions),
    metadata: {
      client_timestamp: validatedValue.timestamp,
      source: 'kinetix_rag_api',
    },
  };
}

/**
 * @param {Record<string, unknown>} body
 * @param {{ supabase?: import('@supabase/supabase-js').SupabaseClient | null }} [options]
 * @returns {Promise<{ ok: true, ticketId: string, receivedAt: string } | { ok: false, error: string }>}
 */
export async function appendSupportTicketRecord(body, options = {}) {
  const validated = validateSupportTicketBody(body);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const ticketId = generateKinetixTicketId();
  const receivedAt = new Date().toISOString();
  const row = buildSupportTicketRow(validated.value, ticketId, receivedAt);

  const supabase = Object.prototype.hasOwnProperty.call(options, 'supabase')
    ? options.supabase
    : getSupabaseServiceClient();
  if (!supabase) {
    return { ok: false, error: 'storage_unavailable' };
  }

  const { error } = await supabase.schema('kinetix').from('support_tickets').insert(row);

  if (error) {
    const code = typeof error.code === 'string' ? error.code : 'unknown';
    console.warn('[Kinetix Support] Supabase insert failed', code);
    return { ok: false, error: 'storage_unavailable' };
  }

  console.info('[Kinetix Support] Ticket created', ticketId);

  return { ok: true, ticketId, receivedAt };
}
