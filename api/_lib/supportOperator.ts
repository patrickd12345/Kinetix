import type { VercelRequest } from '@vercel/node'
import { resolveKinetixRuntimeEnv } from './env/runtime.js'
import { getSupabaseUserFromJwt } from './supabaseUserFromJwt.js'

if (process.env.NODE_ENV === 'production' && process.env.KINETIX_MASTER_ACCESS) {
  throw new Error('KINETIX_MASTER_ACCESS forbidden in production')
}

const MASTER_ACCESS =
  process.env.KINETIX_MASTER_ACCESS === '1' || process.env.KINETIX_MASTER_ACCESS === 'true'

/** Matches `SKIP_AUTH_SESSION.access_token` in apps/web AuthProvider when VITE_SKIP_AUTH is set. */
const VITE_SKIP_AUTH_BYPASS_TOKEN = 'vite-skip-auth-bypass'

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
  const token = parseBearerToken(req)
  if (!token) return null

  if (process.env.NODE_ENV !== 'production' && MASTER_ACCESS && token === VITE_SKIP_AUTH_BYPASS_TOKEN) {
    return { id: 'bypass-dev', email: 'dev@local' }
  }

  if (!runtime.supabaseUrl || !runtime.supabaseAnonKey) return null

  const user = await getSupabaseUserFromJwt(runtime.supabaseUrl, runtime.supabaseAnonKey, token)
  if (!user?.id) return null

  const allowlist = getOperatorAllowlist()
  if (!allowlist.includes(user.id) && !(process.env.NODE_ENV !== 'production' && MASTER_ACCESS)) return null

  return user
}
