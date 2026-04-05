/**
 * Ops-only support ticket status updates (Supabase kinetix.support_tickets).
 * Does not ingest into curated support RAG.
 */

import { getSupabaseServiceClient } from './supportTicketCreate.js';

/** @type {readonly string[]} */
export const SUPPORT_TICKET_STATUSES = Object.freeze([
  'open',
  'triaged',
  'in_progress',
  'resolved',
  'closed',
]);

const STATUS_SET = new Set(SUPPORT_TICKET_STATUSES);

const EXTERNAL_TICKET_ID_RE = /^kinetix-\d{8}-[0-9a-f]{6}$/;

/**
 * @param {unknown} raw
 * @returns {{ ok: true, ticketId: string } | { ok: false, error: string }}
 */
export function validateExternalTicketId(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'ticketId is required' };
  }
  const ticketId = raw.trim();
  if (!EXTERNAL_TICKET_ID_RE.test(ticketId)) {
    return { ok: false, error: 'ticketId must match kinetix-YYYYMMDD-<6 hex>' };
  }
  return { ok: true, ticketId };
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: { status: string, metadataPatch?: Record<string, unknown> } } | { ok: false, error: string }}
 */
export function validateStatusUpdateBody(raw) {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const body = /** @type {Record<string, unknown>} */ (raw);
  const status = body.status;
  if (typeof status !== 'string' || !status.trim()) {
    return { ok: false, error: 'status is required' };
  }
  const s = status.trim();
  if (s !== status) {
    return { ok: false, error: 'status must not have leading or trailing whitespace' };
  }
  if (!STATUS_SET.has(s)) {
    return {
      ok: false,
      error: `status must be one of: ${SUPPORT_TICKET_STATUSES.join(', ')}`,
    };
  }
  if (body.metadataPatch !== undefined) {
    const mp = body.metadataPatch;
    if (mp === null || typeof mp !== 'object' || Array.isArray(mp)) {
      return { ok: false, error: 'metadataPatch must be a plain object' };
    }
  }
  const out = { status: s };
  if (body.metadataPatch !== undefined) {
    out.metadataPatch = /** @type {Record<string, unknown>} */ (body.metadataPatch);
  }
  return { ok: true, value: out };
}

/**
 * @param {Record<string, unknown>} patch
 * @returns {boolean}
 */
function isPlainObject(patch) {
  return patch !== null && typeof patch === 'object' && !Array.isArray(patch);
}

/**
 * @param {string} ticketId
 * @param {string} status
 * @param {{ supabase?: import('@supabase/supabase-js').SupabaseClient | null; metadataPatch?: Record<string, unknown> }} [options]
 * @returns {Promise<
 *   | { ok: true; ticketId: string; status: string; updatedAt: string }
 *   | { ok: false; kind: 'not_found' | 'storage_unavailable' | 'storage_error' }
 * >}
 */
export async function updateSupportTicketStatus(ticketId, status, options = {}) {
  const supabase = Object.prototype.hasOwnProperty.call(options, 'supabase')
    ? options.supabase
    : getSupabaseServiceClient();
  if (!supabase) {
    return { ok: false, kind: 'storage_unavailable' };
  }

  const metadataPatch = options.metadataPatch;
  const hasPatch = metadataPatch && isPlainObject(metadataPatch) && Object.keys(metadataPatch).length > 0;

  if (hasPatch && metadataPatch) {
    const { data: row, error: fetchErr } = await supabase
      .schema('kinetix')
      .from('support_tickets')
      .select('metadata')
      .eq('ticket_id', ticketId)
      .maybeSingle();

    if (fetchErr) {
      console.warn('[Kinetix Support] Supabase select metadata failed');
      return { ok: false, kind: 'storage_error' };
    }
    if (!row) {
      return { ok: false, kind: 'not_found' };
    }
    const prev = isPlainObject(row.metadata) ? row.metadata : {};
    const merged = { ...prev, ...metadataPatch };

    const { data, error: updErr } = await supabase
      .schema('kinetix')
      .from('support_tickets')
      .update({ status, metadata: merged })
      .eq('ticket_id', ticketId)
      .select('ticket_id, status, updated_at')
      .maybeSingle();

    if (updErr) {
      console.warn('[Kinetix Support] Supabase update failed');
      return { ok: false, kind: 'storage_error' };
    }
    if (!data) {
      return { ok: false, kind: 'not_found' };
    }
    return {
      ok: true,
      ticketId: String(data.ticket_id),
      status: String(data.status),
      updatedAt: new Date(data.updated_at).toISOString(),
    };
  }

  const { data, error } = await supabase
    .schema('kinetix')
    .from('support_tickets')
    .update({ status })
    .eq('ticket_id', ticketId)
    .select('ticket_id, status, updated_at')
    .maybeSingle();

  if (error) {
    console.warn('[Kinetix Support] Supabase status update failed');
    return { ok: false, kind: 'storage_error' };
  }
  if (!data) {
    return { ok: false, kind: 'not_found' };
  }

  return {
    ok: true,
    ticketId: String(data.ticket_id),
    status: String(data.status),
    updatedAt: new Date(data.updated_at).toISOString(),
  };
}
