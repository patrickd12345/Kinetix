import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlatformProfileRecord } from './kinetixProfile'

export const KINETIX_PRODUCT_KEY = 'kinetix' as const

type EntitlementRow = {
  status?: string | null
  active?: boolean | null
  expires_at?: string | null
  ends_at?: string | null
  product?: string | null
  product_key?: string | null
  product_slug?: string | null
}

function isEntitlementActive(row: EntitlementRow): boolean {
  if (row.active === false) return false
  if (row.status && row.status.toLowerCase() !== 'active') return false

  const expiry = row.expires_at ?? row.ends_at
  if (expiry) {
    const expiresAt = new Date(expiry).getTime()
    if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) return false
  }

  return true
}

export async function fetchPlatformProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<PlatformProfileRecord | null> {
  const { data, error } = await supabase
    .schema('platform')
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load platform profile: ${error.message}`)
  }

  return (data as PlatformProfileRecord | null) ?? null
}

const PGRST_UNDEFINED_COLUMN = '42703'

async function queryEntitlements(
  supabase: SupabaseClient,
  column: string,
  value: string
): Promise<{ data: EntitlementRow[]; error: { code?: string; message: string } | null }> {
  const { data, error } = await supabase
    .schema('platform')
    .from('entitlements')
    .select('*')
    .eq(column, value)
  return {
    data: (data ?? []) as EntitlementRow[],
    error: error as { code?: string; message: string } | null,
  }
}

export async function hasActiveEntitlementForUser(
  supabase: SupabaseClient,
  profileId: string,
  productKey: string,
  /** If provided, used as fallback when entitlements table is keyed by auth user_id instead of profile_id */
  userId?: string
): Promise<boolean> {
  let result = await queryEntitlements(supabase, 'profile_id', profileId)

  if (result.error && userId) {
    result = await queryEntitlements(supabase, 'user_id', userId)
  }

  if (result.error) {
    const err = result.error
    if (err.code === PGRST_UNDEFINED_COLUMN || (err.message && /does not exist/i.test(err.message))) {
      console.warn(
        '[platformAuth] Entitlements table schema mismatch (e.g. missing profile_id/user_id):',
        err.message
      )
      return false
    }
    throw new Error(
      `Failed to load entitlements: ${err.message}${err.code ? ` (${err.code})` : ''}`
    )
  }

  const rows = result.data
  return rows.some((row) => {
    const key = row.product_key ?? row.product_slug ?? row.product
    return key === productKey && isEntitlementActive(row)
  })
}
