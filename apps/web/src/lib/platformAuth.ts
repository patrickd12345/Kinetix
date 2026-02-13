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

export async function hasActiveEntitlementForUser(
  supabase: SupabaseClient,
  profileId: string,
  productKey: string
): Promise<boolean> {
  const { data, error } = await supabase
    .schema('platform')
    .from('entitlements')
    .select('status,active,expires_at,ends_at,product,product_key,product_slug')
    .eq('profile_id', profileId)

  if (error) {
    throw new Error(`Failed to load entitlements: ${error.message}`)
  }

  const rows = (data ?? []) as EntitlementRow[]
  return rows.some((row) => {
    const key = row.product_key ?? row.product_slug ?? row.product
    return key === productKey && isEntitlementActive(row)
  })
}
