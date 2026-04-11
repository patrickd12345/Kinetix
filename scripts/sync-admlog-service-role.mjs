#!/usr/bin/env node
/**
 * Fetches Supabase API keys via Management API and appends a server-only key to
 * apps/web/.env.local when missing.
 *
 * **Preferred (next-gen):** `SUPABASE_SECRET_KEY` = secret key `sb_secret_...` (Dashboard → API Keys).
 * **Fallback:** legacy JWT `service_role` (only if the project still has legacy keys enabled).
 *
 * Requires in apps/web/.env.local:
 * - VITE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_ACCESS_TOKEN (sbp_... personal access token from supabase.com dashboard)
 *
 * Does not print secret values. Network required.
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'

function parseDotenvFile(filePath) {
  if (!existsSync(filePath)) return {}
  const content = readFileSync(filePath, 'utf8')
  const env = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

function supabaseProjectRefFromUrl(urlString) {
  const u = new URL(urlString)
  const host = u.hostname
  if (!host.endsWith('.supabase.co')) {
    throw new Error('Expected Supabase project URL host *.supabase.co')
  }
  return host.split('.')[0]
}

/** Next-gen elevated key (API gateway verifies; works when JWT legacy keys are disabled). */
function pickNextGenSecretKey(rows) {
  if (!Array.isArray(rows)) return null
  return rows.find((r) => typeof r?.api_key === 'string' && r.api_key.startsWith('sb_secret_')) ?? null
}

function pickLegacyJwtKeys(rows) {
  if (!Array.isArray(rows)) return []
  return rows.filter((r) => r && (r.type === 'legacy' || r.api_key?.startsWith('eyJ')))
}

function jwtPayloadRole(apiKeyJwt) {
  try {
    const parts = String(apiKeyJwt).split('.')
    if (parts.length < 2) return ''
    const json = Buffer.from(parts[1], 'base64url').toString('utf8')
    const payload = JSON.parse(json)
    return typeof payload.role === 'string' ? payload.role : ''
  } catch {
    return ''
  }
}

async function main() {
  const envPath = join(process.cwd(), 'apps', 'web', '.env.local')
  const env = parseDotenvFile(envPath)
  const existingSecret = env.SUPABASE_SECRET_KEY?.trim()
  if (existingSecret?.startsWith('sb_secret_')) {
    console.log(
      '[sync-admlog-service-role] SUPABASE_SECRET_KEY already set (next-gen sb_secret_) — nothing to do.',
    )
    process.exit(0)
  }

  const baseUrl =
    env.VITE_SUPABASE_URL?.trim() || env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.SUPABASE_URL?.trim()
  const pat = env.SUPABASE_ACCESS_TOKEN?.trim()
  if (!baseUrl) {
    console.error('[sync-admlog-service-role] Missing VITE_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).')
    process.exit(1)
  }
  if (!pat) {
    console.error(
      '[sync-admlog-service-role] Missing SUPABASE_ACCESS_TOKEN (sbp_... from https://supabase.com/dashboard/account/tokens).',
    )
    process.exit(1)
  }

  const ref = supabaseProjectRefFromUrl(baseUrl)
  const url = `https://api.supabase.com/v1/projects/${encodeURIComponent(ref)}/api-keys?reveal=true`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(
      `[sync-admlog-service-role] Management API ${res.status}. Add SUPABASE_SECRET_KEY manually (Dashboard → Settings → API Keys → secret key sb_secret_...).`,
    )
    console.error(text.slice(0, 500))
    process.exit(1)
  }

  const data = await res.json()

  const nextGen = pickNextGenSecretKey(data)
  if (nextGen?.api_key) {
    const block = `\n# Injected by scripts/sync-admlog-service-role.mjs (do not commit real prod keys to public repos)\nSUPABASE_SECRET_KEY=${nextGen.api_key}\n`
    appendFileSync(envPath, block, 'utf8')
    console.log(
      '[sync-admlog-service-role] Appended SUPABASE_SECRET_KEY (next-gen sb_secret_) to apps/web/.env.local (value not printed).',
    )
    process.exit(0)
  }

  if (env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.log(
      '[sync-admlog-service-role] No sb_secret_ in Management API response; SUPABASE_SERVICE_ROLE_KEY already set — nothing to append.',
    )
    console.log(
      '[sync-admlog-service-role] Hint: create a secret API key (sb_secret_) in Dashboard → Project Settings → API Keys and set SUPABASE_SECRET_KEY for admlog when JWT legacy keys are disabled.',
    )
    process.exit(0)
  }

  const keys = pickLegacyJwtKeys(data)
  let serviceKey = keys.find((k) => jwtPayloadRole(k.api_key) === 'service_role')
  if (!serviceKey) {
    serviceKey = keys.find((k) => /service|admin/i.test(String(k.name ?? k.description ?? '')))
  }
  if (!serviceKey && keys.length >= 2) {
    serviceKey = keys.find((k) => String(k.api_key ?? '').length > 200) ?? keys[keys.length - 1]
  }
  if (!serviceKey?.api_key) {
    console.error(
      '[sync-admlog-service-role] Could not resolve a secret (sb_secret_) or legacy service_role JWT. Create a secret key in the dashboard or paste SUPABASE_SECRET_KEY manually.',
    )
    process.exit(1)
  }

  console.warn(
    '[sync-admlog-service-role] Warning: using legacy JWT service_role. Prefer SUPABASE_SECRET_KEY (sb_secret_) — legacy keys may be disabled on this project.',
  )
  const block = `\n# Injected by scripts/sync-admlog-service-role.mjs (do not commit real prod keys to public repos)\nSUPABASE_SERVICE_ROLE_KEY=${serviceKey.api_key}\n`
  appendFileSync(envPath, block, 'utf8')
  console.log(
    '[sync-admlog-service-role] Appended SUPABASE_SERVICE_ROLE_KEY to apps/web/.env.local (value not printed).',
  )
}

main().catch((e) => {
  console.error('[sync-admlog-service-role] FAILED:', e instanceof Error ? e.message : e)
  process.exit(1)
})
