import type { VercelRequest } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import type { KinetixRuntimeEnv } from './env/runtime.js'
import { getSupabaseUserFromJwt } from './supabaseUserFromJwt.js'

export type KinetixProvider = 'strava' | 'withings'

export interface VaultToken {
  accessToken: string
  refreshToken: string
  providerUserId: string | null
  expiresAt: string | null
}

export interface ProviderConnectionState {
  provider: KinetixProvider
  connected: boolean
  provider_user_id?: string
  expires_at?: string
  updated_at?: string
}

function readBearerJwt(req: VercelRequest): string | null {
  const header = req.headers.authorization ?? req.headers.Authorization
  const value = Array.isArray(header) ? header[0] : header
  const match = typeof value === 'string' ? /^Bearer\s+(.+)$/i.exec(value.trim()) : null
  return match?.[1] ?? null
}

export async function requireSupabaseUser(req: VercelRequest, runtime: KinetixRuntimeEnv): Promise<{ id: string; email: string | null }> {
  const jwt = readBearerJwt(req)
  if (!jwt) throw new Error('Authentication required')
  const user = await getSupabaseUserFromJwt(runtime.supabaseUrl, runtime.supabaseAnonKey, jwt)
  if (!user) throw new Error('Invalid session')
  return user
}

function serviceClient(runtime: KinetixRuntimeEnv) {
  if (!runtime.supabaseUrl || !runtime.supabaseServiceRoleKey) {
    throw new Error('Supabase service role is not configured')
  }
  return createClient(runtime.supabaseUrl, runtime.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function upsertProviderToken(
  runtime: KinetixRuntimeEnv,
  input: {
    userId: string
    provider: KinetixProvider
    providerUserId?: string | null
    accessToken: string
    refreshToken: string
    expiresAt?: string | null
    scopes?: string[]
    metadata?: Record<string, unknown>
  },
): Promise<ProviderConnectionState> {
  const supabase = serviceClient(runtime)
  const row = {
    product_key: 'kinetix',
    user_id: input.userId,
    provider: input.provider,
    provider_user_id: input.providerUserId ?? null,
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    expires_at: input.expiresAt ?? null,
    scopes: input.scopes ?? [],
    metadata: input.metadata ?? {},
  }
  const { data, error } = await supabase
    .schema('kinetix')
    .from('provider_token_vault')
    .upsert(row, { onConflict: 'user_id,provider' })
    .select('provider, provider_user_id, expires_at, updated_at')
    .single()
  if (error) throw new Error(`Failed to store ${input.provider} connection: ${error.message}`)
  return toConnectionState(data as ProviderTokenVaultPublicRow)
}

export async function getProviderToken(
  runtime: KinetixRuntimeEnv,
  userId: string,
  provider: KinetixProvider,
): Promise<VaultToken | null> {
  const supabase = serviceClient(runtime)
  const { data, error } = await supabase
    .schema('kinetix')
    .from('provider_token_vault')
    .select('access_token, refresh_token, provider_user_id, expires_at')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle()
  if (error) throw new Error(`Failed to load ${provider} connection: ${error.message}`)
  if (!data) return null
  const row = data as {
    access_token: string
    refresh_token: string
    provider_user_id: string | null
    expires_at: string | null
  }
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    providerUserId: row.provider_user_id,
    expiresAt: row.expires_at,
  }
}

export async function deleteProviderToken(
  runtime: KinetixRuntimeEnv,
  userId: string,
  provider: KinetixProvider,
): Promise<void> {
  const supabase = serviceClient(runtime)
  const { error } = await supabase
    .schema('kinetix')
    .from('provider_token_vault')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider)
  if (error) throw new Error(`Failed to disconnect ${provider}: ${error.message}`)
}

type ProviderTokenVaultPublicRow = {
  provider: KinetixProvider
  provider_user_id: string | null
  expires_at: string | null
  updated_at: string | null
}

function toConnectionState(row: ProviderTokenVaultPublicRow): ProviderConnectionState {
  return {
    provider: row.provider,
    connected: true,
    provider_user_id: row.provider_user_id ?? undefined,
    expires_at: row.expires_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  }
}

export async function listProviderConnections(
  runtime: KinetixRuntimeEnv,
  userId: string,
): Promise<ProviderConnectionState[]> {
  const supabase = serviceClient(runtime)
  const { data, error } = await supabase
    .schema('kinetix')
    .from('provider_token_vault')
    .select('provider, provider_user_id, expires_at, updated_at')
    .eq('user_id', userId)
  if (error) throw new Error(`Failed to load provider connections: ${error.message}`)
  return ((data ?? []) as ProviderTokenVaultPublicRow[]).map(toConnectionState)
}

