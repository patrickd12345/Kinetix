#!/usr/bin/env node
/**
 * Phase 4 SSO + entitlement closure verifier.
 *
 * Usage:
 *   node scripts/phase4/verify-sso.mjs --user <email> [--prod]
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from Infisical via env.
 * Does NOT write to the database.
 *
 * Asserts:
 *   1. /api/admlog returns 403 anonymously on the target host
 *   2. /api/ai-chat with {} returns 400 (handler reachable, validation working)
 *   3. /api/support-queue/tickets returns 403 anonymously
 *   4. Magic-link generation for the target user succeeds (auth admin API)
 *
 * Does NOT complete the actual sign-in (requires a human inbox).
 * Emits a markdown row to paste into docs/PHASE4_RELEASE_EVIDENCE.md.
 */

import process from 'node:process'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, a) => {
    if (cur.startsWith('--')) {
      const next = a[i + 1]
      acc.push([cur.slice(2), next && !next.startsWith('--') ? next : true])
    }
    return acc
  }, [])
)

const isProd = Boolean(args.prod)
const host = isProd ? 'https://kinetix.bookiji.com' : 'http://localhost:3000'
const userEmail = typeof args.user === 'string' ? args.user : null
if (!userEmail) {
  console.error('--user <email> is required')
  process.exit(2)
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (run via Infisical or .env.local)')
  process.exit(2)
}

let createClient
try {
  ;({ createClient } = await import('@supabase/supabase-js'))
} catch (err) {
  console.error('Failed to import @supabase/supabase-js. Run pnpm install first.')
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(2)
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []

async function probe(label, url, expectedStatus, init) {
  let actualStatus = 0
  let errorMessage
  try {
    const r = await fetch(url, { ...init, redirect: 'manual' })
    actualStatus = r.status
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
  }
  const ok = actualStatus === expectedStatus
  results.push({ label, url, expected: expectedStatus, actual: actualStatus, ok, error: errorMessage })
  const tag = ok ? 'PASS' : 'FAIL'
  const detail = errorMessage ? ` error=${errorMessage}` : ''
  console.log(`${tag} ${label} -> ${actualStatus} (expected ${expectedStatus})${detail}`)
}

await probe('admlog 403', `${host}/api/admlog`, 403)
await probe('ai-chat 400', `${host}/api/ai-chat`, 400, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
})
await probe('support-queue 403', `${host}/api/support-queue/tickets`, 403)

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: userEmail,
})
if (linkErr) {
  results.push({ label: 'magic-link generate', ok: false, error: linkErr.message })
  console.log(`FAIL magic-link generate -> ${linkErr.message}`)
} else {
  const hasUrl = Boolean(linkData?.properties?.action_link)
  results.push({ label: 'magic-link generate', ok: hasUrl })
  console.log(hasUrl ? 'PASS magic-link generate' : 'FAIL magic-link generate (no action_link returned)')
}

const allOk = results.every((r) => r.ok)
const stamp = new Date().toISOString()
const summary = results
  .map((r) => `${r.label}: ${r.ok ? 'PASS' : `FAIL${r.error ? ` (${r.error})` : ''}`}`)
  .join(', ')

console.log('\nMARKDOWN ROW (paste into docs/PHASE4_RELEASE_EVIDENCE.md):\n')
console.log(`| ${stamp} | ${host} | ${allOk ? 'PASS' : 'FAIL'} | ${summary} |`)
process.exit(allOk ? 0 : 1)
