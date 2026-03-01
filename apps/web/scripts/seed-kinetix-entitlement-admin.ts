#!/usr/bin/env tsx
/**
 * Seed or upsert an active Kinetix entitlement through Supabase HTTP APIs.
 *
 * Preferred auth: SUPABASE_SECRET_KEY=sb_secret_...
 * Legacy fallback: SUPABASE_SERVICE_ROLE_KEY (only if legacy keys are enabled)
 *
 * Usage examples (run from apps/web):
 *  pnpm exec tsx scripts/seed-kinetix-entitlement-admin.ts --user-id <uuid>
 *  pnpm exec tsx scripts/seed-kinetix-entitlement-admin.ts --email someone@example.com
 *  pnpm exec tsx scripts/seed-kinetix-entitlement-admin.ts --email someone@example.com --create-user --password "StrongPass123!"
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type HeaderVariant = 'apikey-only' | 'apikey-and-authorization'

interface RequestOptions {
  acceptProfile?: string
  contentProfile?: string
  prefer?: string
}

interface ParsedArgs {
  userId?: string
  email?: string
  password?: string
  createUser: boolean
  productKey: string
  entitlementKey: string
  source: string
}

function loadEnvLocal() {
  const paths = [resolve(process.cwd(), '.env.local'), resolve(process.cwd(), '.env')]
  for (const p of paths) {
    if (!existsSync(p)) continue
    const content = readFileSync(p, 'utf-8')
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/)
      if (!m) continue
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
    break
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    createUser: false,
    productKey: 'kinetix',
    entitlementKey: 'default',
    source: 'manual',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]

    if (arg === '--create-user') {
      out.createUser = true
      continue
    }
    if (arg === '--user-id' && next) {
      out.userId = next
      i += 1
      continue
    }
    if (arg === '--email' && next) {
      out.email = next
      i += 1
      continue
    }
    if (arg === '--password' && next) {
      out.password = next
      i += 1
      continue
    }
    if (arg === '--product-key' && next) {
      out.productKey = next
      i += 1
      continue
    }
    if (arg === '--entitlement-key' && next) {
      out.entitlementKey = next
      i += 1
      continue
    }
    if (arg === '--source' && next) {
      out.source = next
      i += 1
      continue
    }
  }

  return out
}

function exitWithUsage(message: string): never {
  console.error(message)
  console.error(
    'Usage: --user-id <uuid> OR --email <email> [--create-user --password <password>] [--product-key kinetix] [--entitlement-key default]'
  )
  process.exit(1)
}

function parseJson<T>(text: string): T {
  if (!text) return [] as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Expected JSON response but received: ${text.slice(0, 300)}`)
  }
}

function buildHeaders(
  key: string,
  variant: HeaderVariant,
  options?: RequestOptions
): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: key,
  }

  if (variant === 'apikey-and-authorization') {
    headers.Authorization = `Bearer ${key}`
  }

  if (options?.acceptProfile) headers['Accept-Profile'] = options.acceptProfile
  if (options?.contentProfile) headers['Content-Profile'] = options.contentProfile
  if (options?.prefer) headers.Prefer = options.prefer

  return headers
}

async function requestWithKey(
  url: string,
  key: string,
  method: 'GET' | 'POST',
  options?: RequestOptions,
  body?: unknown
) {
  const variants: HeaderVariant[] = ['apikey-only', 'apikey-and-authorization']
  const errors: string[] = []

  for (const variant of variants) {
    const headers = buildHeaders(key, variant, options)
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    if (res.ok) {
      return { res, text, variant }
    }
    errors.push(
      `${variant}: ${res.status} ${text.slice(0, 300) || '<empty>'}`
    )
  }

  throw new Error(`Request failed (${method} ${url})\n${errors.join('\n')}`)
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))

  if (!args.userId && !args.email) {
    exitWithUsage('Missing identity argument.')
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) exitWithUsage('Missing VITE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.')

  const adminKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY
  if (!adminKey) {
    exitWithUsage('Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY).')
  }

  let userId = args.userId

  if (!userId && args.email) {
    const profilesUrl = new URL('/rest/v1/profiles', supabaseUrl)
    profilesUrl.searchParams.set('select', 'id,email')
    profilesUrl.searchParams.set('email', `eq.${args.email}`)
    profilesUrl.searchParams.set('limit', '1')

    const profileResp = await requestWithKey(
      profilesUrl.toString(),
      adminKey,
      'GET',
      { acceptProfile: 'platform' }
    )
    const rows = parseJson<Array<{ id: string; email: string }>>(profileResp.text)
    userId = rows[0]?.id

    if (!userId && args.createUser) {
      if (!args.password) {
        exitWithUsage('Missing --password while using --create-user.')
      }
      const createUrl = new URL('/auth/v1/admin/users', supabaseUrl)
      const createResp = await requestWithKey(
        createUrl.toString(),
        adminKey,
        'POST',
        undefined,
        {
          email: args.email,
          password: args.password,
          email_confirm: true,
        }
      )
      const created = parseJson<{ id?: string; user?: { id?: string } }>(createResp.text)
      userId = created.id ?? created.user?.id
    }
  }

  if (!userId) {
    throw new Error(
      'Unable to resolve user id. Provide --user-id directly, or --email with an existing platform.profiles row.'
    )
  }

  const payload = [
    {
      user_id: userId,
      product_key: args.productKey,
      entitlement_key: args.entitlementKey,
      active: true,
      source: args.source,
      metadata: {
        seeded_by: 'seed-kinetix-entitlement-admin.ts',
        timestamp: new Date().toISOString(),
      },
      starts_at: new Date().toISOString(),
      ends_at: null,
    },
  ]

  const entitlementsUrl = new URL('/rest/v1/entitlements', supabaseUrl)
  entitlementsUrl.searchParams.set('on_conflict', 'user_id,product_key,entitlement_key')
  entitlementsUrl.searchParams.set(
    'select',
    'id,user_id,product_key,entitlement_key,active,source,starts_at,ends_at,updated_at'
  )

  const writeResp = await requestWithKey(
    entitlementsUrl.toString(),
    adminKey,
    'POST',
    {
      contentProfile: 'platform',
      acceptProfile: 'platform',
      prefer: 'resolution=merge-duplicates,return=representation',
    },
    payload
  )

  const rows = parseJson<Array<Record<string, unknown>>>(writeResp.text)
  console.log('Entitlement upsert succeeded.')
  console.log('Auth header mode:', writeResp.variant)
  console.log('Rows:', rows.length)
  console.log(JSON.stringify(rows, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
