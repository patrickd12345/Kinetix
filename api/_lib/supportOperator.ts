import type { VercelRequest } from '@vercel/node'
import { resolveKinetixRuntimeEnv } from './env/runtime.js'
import { getSupabaseUserFromJwt } from './supabaseUserFromJwt.js'

// SEC-07: Double-wall production check. Rely on both VERCEL_ENV and NODE_ENV.
const isProductionEnviroment = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'

if (isProductionEnviroment && process.env.KINETIX_MASTER_ACCESS) {
  throw new Error('KINETIX_MASTER_ACCESS absolutely forbidden in production')
}

const MASTER_ACCESS =
  !isProductionEnviroment &&
  (process.env.KINETIX_MASTER_ACCESS === '1' || process.env.KINETIX_MASTER_ACCESS === 'true')

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

  if (!isProductionEnviroment && MASTER_ACCESS && token === VITE_SKIP_AUTH_BYPASS_TOKEN) {
    return { id: 'bypass-dev', email: 'dev@local' }
  }

  if (!runtime.supabaseUrl || !runtime.supabaseAnonKey) return null

  const user = await getSupabaseUserFromJwt(runtime.supabaseUrl, runtime.supabaseAnonKey, token)
  if (!user?.id) return null

  const allowlist = getOperatorAllowlist()
  if (!allowlist.includes(user.id) && !(!isProductionEnviroment && MASTER_ACCESS)) return null

  return user
}
