import type { VercelRequest } from '@vercel/node'
import { resolveKinetixRuntimeEnv } from './env/runtime.js'
import { getSupabaseUserFromJwt } from './supabaseUserFromJwt.js'

export interface SupportOperatorUser {
  id: string
  email: string | null
}

function parseBearerToken(req: VercelRequest): string {
  const authHeader = (req.headers.authorization ?? req.headers.Authorization) as string | undefined
  return typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : ''
}

function getOperatorAllowlist(): string[] {
  return resolveKinetixRuntimeEnv()
    .kinetixSupportOperatorUserIds.split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export async function requireSupportOperator(req: VercelRequest): Promise<SupportOperatorUser | null> {
  const runtime = resolveKinetixRuntimeEnv()
  if (!runtime.supabaseUrl || !runtime.supabaseAnonKey) return null
  const token = parseBearerToken(req)
  if (!token) return null

  const user = await getSupabaseUserFromJwt(runtime.supabaseUrl, runtime.supabaseAnonKey, token)
  if (!user?.id) return null

  const allowlist = getOperatorAllowlist()
  if (!allowlist.includes(user.id)) return null

  return user
}
