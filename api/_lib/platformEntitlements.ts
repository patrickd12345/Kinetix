/**
 * Server-side entitlement evaluation for `platform.entitlements` (Spine v1).
 * Mirrors client logic in `apps/web/src/lib/platformAuth.ts` without importing web-only modules.
 */

export type EntitlementRow = {
  active?: boolean | null
  status?: string | null
  expires_at?: string | null
  ends_at?: string | null
  source?: string | null
}

export function isEntitlementRowActive(row: EntitlementRow): boolean {
  if (row.active === false) return false
  if (row.status && row.status.toLowerCase() !== 'active') return false

  const expiry = row.expires_at ?? row.ends_at
  if (expiry) {
    const expiresAt = new Date(expiry).getTime()
    if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) return false
  }

  return true
}

const PRODUCT_KEYS = new Set(['bookiji', 'kinetix', 'chess'])

export function parseProductKey(raw: string | undefined): string | null {
  const k = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (!k || !PRODUCT_KEYS.has(k)) return null
  return k
}

export function aggregateEntitlementPayload(rows: EntitlementRow[]): {
  active: boolean
  ends_at: string | null
  source: string | null
} {
  const activeRows = rows.filter(isEntitlementRowActive)
  if (activeRows.length === 0) {
    return { active: false, ends_at: null, source: null }
  }

  let endsAtMs = -Infinity
  let endsAtIso: string | null = null
  for (const row of activeRows) {
    const raw = row.ends_at ?? row.expires_at
    if (!raw) continue
    const t = new Date(raw).getTime()
    if (!Number.isNaN(t) && t > endsAtMs) {
      endsAtMs = t
      endsAtIso = new Date(t).toISOString()
    }
  }

  const stripe = activeRows.find((r) => r.source === 'stripe')
  const source = stripe?.source ?? activeRows.find((r) => r.source)?.source ?? null

  return {
    active: true,
    ends_at: endsAtIso,
    source,
  }
}
