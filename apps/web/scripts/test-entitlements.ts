#!/usr/bin/env tsx
/**
 * Reproduce the platform entitlements request and log the full Supabase error.
 * Run from apps/web: pnpm exec tsx scripts/test-entitlements.ts [profile_id]
 * Requires .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const paths = [resolve(process.cwd(), '.env.local'), resolve(process.cwd(), '.env')]
  for (const p of paths) {
    if (!existsSync(p)) continue
    const content = readFileSync(p, 'utf-8')
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
    break
  }
}

loadEnvLocal()

const url = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key =
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

const profileId = process.argv[2] ?? '2d6e3cef-dd9f-4662-838e-0d655d5e0e3c'

async function main() {
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, key)
  const userId = process.argv[3] ?? profileId

  console.log('1) Query with profile_id:', profileId)
  let { data, error } = await supabase
    .schema('platform')
    .from('entitlements')
    .select('*')
    .eq('profile_id', profileId)

  if (error) {
    console.error('profile_id error:', (error as { code?: string }).code, error.message)
    console.log('\n2) Trying user_id:', userId)
    const r2 = await supabase
      .schema('platform')
      .from('entitlements')
      .select('*')
      .eq('user_id', userId)
    if (r2.error) {
      console.error('user_id error:', (r2.error as { code?: string }).code, r2.error.message)
      console.error('\nFull profile_id error:', JSON.stringify(error, null, 2))
      process.exit(1)
    }
    data = r2.data
    error = null
  }

  if (error) {
    console.error('Full error:', JSON.stringify(error, null, 2))
    process.exit(1)
  }

  console.log('Rows:', data?.length ?? 0, data)
}

main()
