/**
 * Platform Spine — shared admin one-shot dev login (admlog).
 * All Bookiji Inc apps (Bookiji, Kinetix, future) use this; only admlog is in the common trunk.
 */

import { createClient, type User } from '@supabase/supabase-js'

export const ADMLOG_EMAIL = 'admlog@bookiji.test'
const DEFAULT_PASSWORD_LOCAL = 'AdmlogDev123!'

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

/**
 * Ensures the platform admin dev user exists, signs in with anon client, returns session tokens.
 * Caller (app) is responsible for setting cookies and redirecting.
 *
 * **API keys (hosted Supabase):** pass the **secret** key (`sb_secret_...`, env `SUPABASE_SECRET_KEY`)
 * as `serviceKey`. Legacy JWT `service_role` only works while JWT legacy API keys are enabled; when
 * they are disabled, Auth Admin APIs return errors such as "Legacy API keys are disabled".
 * Use **publishable** (`sb_publishable_...`) or legacy **anon** JWT for `anonKey`.
 */
export async function performAdmlogSignIn(config: {
  supabaseUrl: string
  serviceKey: string
  anonKey: string
  /**
   * When set (e.g. `['kinetix']` for Kinetix), upserts `platform.entitlements` for the admlog user
   * so gated apps pass `hasActiveEntitlementForUser` after sign-in.
   */
  ensureEntitlementProductKeys?: readonly string[]
}): Promise<AdmlogTokens> {
  const { supabaseUrl, serviceKey, anonKey, ensureEntitlementProductKeys } = config
  const password =
    process.env.ADMLOG_PASSWORD ??
    (process.env.BOOKIJI_TEST_MODE === 'true' ? DEFAULT_PASSWORD_LOCAL : '')
  if (!password) {
    throw new Error('ADMLOG_PASSWORD is required when ADMLOG_ENABLED or BOOKIJI_TEST_MODE is set')
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: listData } = await admin.auth.admin.listUsers()
  const existingUser = listData?.users?.find((u: User) => u.email === ADMLOG_EMAIL)

  const platformProfiles = (
    admin as unknown as {
      schema: (s: string) => {
        from: (t: string) => {
          update: (v: object) => { eq: (c: string, v: string) => PromiseLike<unknown> }
        }
      }
    }
  ).schema('platform').from('profiles')

  let admlogUserId: string

  if (existingUser) {
    admlogUserId = existingUser.id
    try {
      await admin.auth.admin.updateUserById(existingUser.id, { password })
    } catch {
      // continue
    }
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
      await platformProfiles.update({ role: 'admin', updated_at: new Date().toISOString() }).eq('id', newUser.user.id)
    } catch (e) {
      console.warn('[ADMLOG] Could not set platform.profiles.role for admlog user', e)
    }
  }

  const productKeys = ensureEntitlementProductKeys?.filter((k) => k.trim().length > 0) ?? []
  if (productKeys.length > 0) {
    const entitlements = (
      admin as unknown as {
        schema: (s: string) => {
          from: (t: string) => {
            upsert: (
              rows: Record<string, unknown> | Record<string, unknown>[],
              opts?: { onConflict?: string }
            ) => PromiseLike<{ error: { message: string } | null }>
          }
        }
      }
    )
      .schema('platform')
      .from('entitlements')
    const now = new Date().toISOString()
    for (const productKey of productKeys) {
      try {
        const { error: entError } = await entitlements.upsert(
          {
            user_id: admlogUserId,
            product_key: productKey,
            entitlement_key: 'default',
            active: true,
            source: 'admlog-dev',
            metadata: { seeded_by: 'performAdmlogSignIn', timestamp: now },
            starts_at: now,
            ends_at: null,
          },
          { onConflict: 'user_id,product_key,entitlement_key' }
        )
        if (entError) {
          console.warn(`[ADMLOG] entitlement upsert for ${productKey}: ${entError.message}`)
        }
      } catch (e) {
        console.warn(`[ADMLOG] Could not upsert entitlement for ${productKey}`, e)
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
