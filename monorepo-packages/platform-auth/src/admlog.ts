/**
 * Platform Spine — shared admin one-shot dev login (admlog).
 * All Bookiji Inc apps (Bookiji, Kinetix, future) use this; only admlog is in the common trunk.
 */

import { createClient, type User } from '@supabase/supabase-js'

export const ADMLOG_EMAIL = 'admlog@bookiji.test'

function isProduction(): boolean {
  if (process.env.NODE_ENV === 'production') return true
  if (process.env.VERCEL_ENV === 'production') return true
  return false
}

/**
 * True when NODE_ENV or VERCEL_ENV indicates production — admlog is never enabled in this case.
 * Callers may use this for logging or UI without duplicating production detection.
 */
export function isAdmlogProductionEnvironment(): boolean {
  return isProduction()
}

/** True when non-production and ADMLOG_ENABLED or BOOKIJI_TEST_MODE is set. */
export function isAdmlogEnabled(): boolean {
  if (isProduction()) return false
  const admlogEnabled = process.env.ADMLOG_ENABLED === 'true'
  const bookijiTestMode = process.env.BOOKIJI_TEST_MODE === 'true'
  return admlogEnabled || bookijiTestMode
}

export interface AdmlogBlockReason {
  criteria: string[]
  howToEnable: string
}

/** Canonical 403 body when admlog is disabled due to a production deployment (runtime or env). */
export function getAdmlogProductionBlockReason(): AdmlogBlockReason {
  return {
    criteria: ['NODE_ENV or VERCEL_ENV is production'],
    howToEnable:
      'Admlog is not available in production. Do not enable ADMLOG_ENABLED or BOOKIJI_TEST_MODE on Vercel Production. Use Preview, local development, or another non-production environment when admlog is needed.',
  }
}

/** Returns which criteria are blocking and how to enable admlog (non-production only). */
export function getAdmlogBlockReason(): AdmlogBlockReason {
  if (isProduction()) {
    return getAdmlogProductionBlockReason()
  }

  const criteria: string[] = []
  const admlogEnabled = process.env.ADMLOG_ENABLED === 'true'
  const bookijiTestMode = process.env.BOOKIJI_TEST_MODE === 'true'
  if (!admlogEnabled && !bookijiTestMode) {
    criteria.push('Neither ADMLOG_ENABLED nor BOOKIJI_TEST_MODE is set to "true"')
  }
  const howToEnable =
    criteria.length === 0
      ? ''
      : 'Set ADMLOG_ENABLED=true or BOOKIJI_TEST_MODE=true and ADMLOG_PASSWORD in non-production.'
  return { criteria, howToEnable }
}

export interface AdmlogTokens {
  access_token: string
  refresh_token: string
}

/** Spine `platform.entitlements.product_key` check constraint (see platform_spine migrations). */
const ADMLOG_ENTITLEMENT_PRODUCT_KEYS = new Set(['bookiji', 'kinetix', 'chess'])
/** Stable key for admlog-granted rows; distinct from Stripe-driven keys. */
const ADMLOG_ENTITLEMENT_KEY = 'admlog_dev'

/**
 * Ensures the platform admin dev user exists, signs in with anon client, returns session tokens.
 * Caller (app) is responsible for setting cookies and redirecting.
 */
export async function performAdmlogSignIn(config: {
  supabaseUrl: string
  serviceKey: string
  anonKey: string
  /**
   * Optional `platform.entitlements.product_key` values to upsert for the admlog user so SPA
   * entitlement gating passes without a separate DB seed (e.g. `['kinetix']`).
   */
  ensureEntitlementProductKeys?: string[]
}): Promise<AdmlogTokens> {
  const { supabaseUrl, serviceKey, anonKey, ensureEntitlementProductKeys } = config
  const password = process.env.ADMLOG_PASSWORD
  if (!password) {
    throw new Error('ADMLOG_PASSWORD is required when ADMLOG_ENABLED or BOOKIJI_TEST_MODE is set')
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: listData } = await admin.auth.admin.listUsers()
  const existingUser = listData?.users?.find((u: User) => u.email === ADMLOG_EMAIL)

  let admlogUserId: string

  if (existingUser) {
    admlogUserId = existingUser.id
    try {
      await admin.auth.admin.updateUserById(existingUser.id, { password })
    } catch {
      // continue
    }
    const platformProfiles = (admin as unknown as { schema: (s: string) => { from: (t: string) => { update: (v: object) => { eq: (c: string, v: string) => PromiseLike<unknown> } } } }).schema('platform').from('profiles')
    await platformProfiles.update({ role: 'admin', updated_at: new Date().toISOString() }).eq('id', existingUser.id)
  } else {
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: ADMLOG_EMAIL,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: 'Admlog Dev Admin',
        role: 'admin',
        is_synthetic: true,
        created_for: 'admlog-dev-login',
      },
    })
    if (createError || !newUser?.user) {
      throw new Error(`Failed to create admlog user: ${createError?.message ?? 'Unknown error'}`)
    }
    admlogUserId = newUser.user.id
    try {
      const platformProfiles = (admin as unknown as { schema: (s: string) => { from: (t: string) => { update: (v: object) => { eq: (c: string, v: string) => PromiseLike<unknown> } } } }).schema('platform').from('profiles')
      await platformProfiles.update({ role: 'admin', updated_at: new Date().toISOString() }).eq('id', newUser.user.id)
    } catch (e) {
      console.warn('[ADMLOG] Could not set platform.profiles.role for admlog user', e)
    }
  }

  if (ensureEntitlementProductKeys?.length) {
    for (const raw of ensureEntitlementProductKeys) {
      const productKey = raw.trim()
      if (!ADMLOG_ENTITLEMENT_PRODUCT_KEYS.has(productKey)) {
        console.warn('[ADMLOG] Ignoring invalid product_key for entitlement upsert:', raw)
        continue
      }
      const platformEntitlements = (
        admin as unknown as {
          schema: (s: string) => {
            from: (t: string) => {
              upsert: (
                row: Record<string, unknown>,
                opts?: { onConflict?: string }
              ) => PromiseLike<{ error: { message: string } | null }>
            }
          }
        }
      )
        .schema('platform')
        .from('entitlements')
      const { error: entError } = await platformEntitlements.upsert(
        {
          user_id: admlogUserId,
          product_key: productKey,
          entitlement_key: ADMLOG_ENTITLEMENT_KEY,
          active: true,
          source: 'admlog',
          metadata: {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,product_key,entitlement_key' }
      )
      if (entError) {
        console.warn('[ADMLOG] Could not upsert platform.entitlements for admlog user', productKey, entError)
      }
    }
  }

  const anon = createClient(supabaseUrl, anonKey)
  const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
    email: ADMLOG_EMAIL,
    password,
  })

  if (signInError || !signInData?.session?.access_token || !signInData?.session?.refresh_token) {
    throw new Error(signInError?.message ?? 'Failed to obtain session')
  }

  return {
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
  }
}
