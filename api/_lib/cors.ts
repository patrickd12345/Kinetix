import type { VercelRequest, VercelResponse } from '@vercel/node'
import { resolveKinetixRuntimeEnv } from './env/runtime'

interface CorsOptions {
  methods: string[]
  headers: string[]
  allowCredentials?: boolean
}

interface CorsResult {
  allowed: boolean
}

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '')
}

function readOrigin(req: VercelRequest): string | null {
  const value = req.headers?.origin
  if (Array.isArray(value)) return value[0] ? normalizeOrigin(value[0]) : null
  if (typeof value === 'string' && value.trim()) return normalizeOrigin(value)
  return null
}

function getAllowlist(): string[] {
  const raw = resolveKinetixRuntimeEnv().corsAllowedOrigins || ''
  return raw
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean)
}

function appendVary(res: VercelResponse, key: string): void {
  if (typeof (res as any).getHeader !== 'function') {
    res.setHeader('Vary', key)
    return
  }

  const existing = res.getHeader('Vary')
  if (!existing) {
    res.setHeader('Vary', key)
    return
  }
  const text = Array.isArray(existing) ? existing.join(', ') : String(existing)
  const values = text
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  if (!values.includes(key)) {
    values.push(key)
  }
  res.setHeader('Vary', values.join(', '))
}

function isProductionCorsStrict(runtime: ReturnType<typeof resolveKinetixRuntimeEnv>): boolean {
  if (runtime.nodeEnv === 'production') return true
  return runtime.vercelEnv === 'production' || runtime.vercelEnv === 'preview'
}

export function applyCors(req: VercelRequest, res: VercelResponse, options: CorsOptions): CorsResult {
  const runtime = resolveKinetixRuntimeEnv()
  const origin = readOrigin(req)
  const allowlist = getAllowlist()
  const prodMissingAllowlist = isProductionCorsStrict(runtime) && allowlist.length === 0

  if (prodMissingAllowlist) {
    const allowed = !origin
    res.setHeader('Access-Control-Allow-Origin', 'null')
    appendVary(res, 'Origin')
    res.setHeader('Access-Control-Allow-Methods', options.methods.join(', '))
    res.setHeader('Access-Control-Allow-Headers', options.headers.join(', '))
    if (options.allowCredentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    return { allowed }
  }

  const restricted = allowlist.length > 0
  const allowAll = allowlist.includes('*')
  const allowed = !restricted || allowAll || !origin || allowlist.includes(origin)

  const allowOrigin = !restricted || allowAll ? '*' : allowed && origin ? origin : 'null'
  res.setHeader('Access-Control-Allow-Origin', allowOrigin)
  appendVary(res, 'Origin')
  res.setHeader('Access-Control-Allow-Methods', options.methods.join(', '))
  res.setHeader('Access-Control-Allow-Headers', options.headers.join(', '))
  if (options.allowCredentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }

  return { allowed }
}
