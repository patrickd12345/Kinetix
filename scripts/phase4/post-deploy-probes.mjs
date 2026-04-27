#!/usr/bin/env node
/**
 * Post-deploy production probe set. Run after promoting a Vercel deployment.
 *
 * Usage:
 *   node scripts/phase4/post-deploy-probes.mjs [--host https://kinetix.bookiji.com]
 *
 * Anonymous, read-only. Verifies the deployment did not regress the
 * baseline contracts captured in PHASE4_RELEASE_EVIDENCE.md.
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

const host = (typeof args.host === 'string' && args.host) || 'https://kinetix.bookiji.com'

const probes = [
  { method: 'GET', path: '/api/admlog', expected: 403, label: 'admlog disabled in prod' },
  {
    method: 'POST',
    path: '/api/ai-chat',
    expected: 400,
    label: 'ai-chat handler reachable',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  },
  { method: 'GET', path: '/api/support-queue/tickets', expected: 403, label: 'support-queue tickets gated' },
  { method: 'GET', path: '/api/support-queue/kb-approval', expected: 403, label: 'support-queue kb-approval gated' },
  { method: 'GET', path: '/', expected: 200, label: 'SPA shell 200', allowRedirect: true },
]

const results = []

for (const probe of probes) {
  const url = `${host}${probe.path}`
  let actual = 0
  let location
  let bodyExcerpt
  let errorMessage
  try {
    const r = await fetch(url, {
      method: probe.method,
      headers: probe.headers,
      body: probe.body,
      redirect: 'manual',
    })
    actual = r.status
    location = r.headers.get('location') || undefined
    if (probe.path !== '/') {
      try {
        const text = await r.text()
        bodyExcerpt = text.slice(0, 160)
      } catch {
        // ignore
      }
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  let ok = actual === probe.expected
  if (!ok && probe.allowRedirect && actual >= 300 && actual < 400) ok = true

  results.push({ ...probe, actual, location, bodyExcerpt, ok, error: errorMessage })
  const tag = ok ? 'PASS' : 'FAIL'
  const detail = errorMessage ? ` error=${errorMessage}` : location ? ` -> ${location}` : ''
  console.log(`${tag} ${probe.method} ${probe.path} -> ${actual} (expected ${probe.expected})${detail}`)
}

const allOk = results.every((r) => r.ok)
const stamp = new Date().toISOString()
const summary = results
  .map((r) => `${r.method} ${r.path}=${r.ok ? 'PASS' : `FAIL(${r.actual})`}`)
  .join('; ')

console.log('\nMARKDOWN ROW (paste into docs/PHASE4_RELEASE_EVIDENCE.md):\n')
console.log(`| ${stamp} | ${host} | ${allOk ? 'PASS' : 'FAIL'} | ${summary} |`)
process.exit(allOk ? 0 : 1)
