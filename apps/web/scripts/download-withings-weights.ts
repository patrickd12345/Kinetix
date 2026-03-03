#!/usr/bin/env tsx
/**
 * One-off script: download all historical Withings weights to a JSON file.
 *
 * Prerequisites:
 * - Withings app connected in Kinetix (Settings). Then get your refresh_token:
 *   - Open DevTools > Application > Local Storage > your origin > key "kinetix-settings"
 *   - Copy the value, paste in a JSON formatter, find "withingsCredentials.refreshToken"
 *   - Or run from project root with: WITHINGS_REFRESH_TOKEN="your_refresh_token"
 *
 * Env (from .env.local or shell):
 * - VITE_WITHINGS_CLIENT_ID (or WITHINGS_CLIENT_ID)
 * - WITHINGS_CLIENT_SECRET
 * - WITHINGS_REFRESH_TOKEN (refresh token from the app's stored credentials)
 *
 * Usage:
 *   pnpm withings:weights [output.json]
 *   # or
 *   cd apps/web && pnpm tsx scripts/download-withings-weights.ts [output.json]
 *
 * Output: JSON array of { date: string (ISO), dateUnix: number, kg: number } sorted newest first.
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { withingsRequestToken } from '../src/lib/withingsOAuthServer'

const WITHINGS_MEASURE_URL = 'https://wbsapi.withings.net/measure'
const WEIGHT_TYPE = 1
const WEIGHT_UNIT_EXP = -2

function loadEnvLocal(): void {
  const root = join(process.cwd(), '.env.local')
  try {
    const content = readFileSync(root, 'utf8')
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (m) {
        const key = m[1]
        const val = m[2].replace(/^["']|["']$/g, '').trim()
        if (!process.env[key]) process.env[key] = val
      }
    }
  } catch {
    // .env.local optional
  }
}

async function getAccessToken(): Promise<string> {
  const clientId =
    process.env.VITE_WITHINGS_CLIENT_ID ?? process.env.WITHINGS_CLIENT_ID ?? ''
  const clientSecret = process.env.WITHINGS_CLIENT_SECRET ?? ''
  const refreshToken = process.env.WITHINGS_REFRESH_TOKEN ?? ''

  if (!clientId || !clientSecret) {
    throw new Error(
      'Set VITE_WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET (e.g. in .env.local).'
    )
  }
  if (!refreshToken) {
    throw new Error(
      'Set WITHINGS_REFRESH_TOKEN. Get it from the app: DevTools > Application > Local Storage > kinetix-settings > withingsCredentials.refreshToken'
    )
  }

  const result = await withingsRequestToken(clientId, clientSecret, {
    action: 'requesttoken',
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  return result.access_token
}

async function fetchAllWeights(accessToken: string): Promise<{ date: string; dateUnix: number; kg: number }[]> {
  const now = Math.floor(Date.now() / 1000)
  const start = 0
  const body = new URLSearchParams({
    action: 'getmeas',
    startdate: String(start),
    enddate: String(now),
    meastypes: String(WEIGHT_TYPE),
  })

  const res = await fetch(WITHINGS_MEASURE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Withings getmeas failed: ${res.status} ${text}`)
  }

  const json = (await res.json()) as {
    status?: number
    body?: {
      measuregrps?: Array<{
        measures?: Array<{ type: number; value: number; unit: number }>
        date: string | number
      }>
      error?: string
    }
  }
  if (json?.status !== 0) {
    throw new Error(json?.body?.error ?? 'Withings getmeas error')
  }

  const groups = json?.body?.measuregrps ?? []
  const out: { date: string; dateUnix: number; kg: number }[] = []

  for (const g of groups) {
    const w = g.measures?.find((m) => m.type === WEIGHT_TYPE)
    if (!w) continue
    const exp = typeof w.unit === 'number' ? w.unit : WEIGHT_UNIT_EXP
    const kg = w.value * Math.pow(10, exp)
    const dateUnix =
      typeof g.date === 'number' ? g.date : parseInt(String(g.date), 10) || 0
    out.push({
      date: new Date(dateUnix * 1000).toISOString(),
      dateUnix,
      kg: Math.round(kg * 100) / 100,
    })
  }

  out.sort((a, b) => b.dateUnix - a.dateUnix)
  return out
}

async function main(): Promise<void> {
  loadEnvLocal()

  const outPath = process.argv[2] ?? join(process.cwd(), 'withings-weights-history.json')

  console.log('Refreshing Withings token...')
  const accessToken = await getAccessToken()
  console.log('Fetching all weight measurements...')
  const weights = await fetchAllWeights(accessToken)
  console.log(`Got ${weights.length} weight entries.`)

  writeFileSync(outPath, JSON.stringify(weights, null, 2), 'utf8')
  console.log(`Wrote ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
