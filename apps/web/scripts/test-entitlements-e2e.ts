#!/usr/bin/env tsx
/**
 * Full entitlement validation flow using an existing magic-link session token:
 * get user -> profile -> entitlements.
 * Run from apps/web: pnpm exec tsx scripts/test-entitlements-e2e.ts
 * Requires .env.local: VITE_SUPABASE_* and E2E_ACCESS_TOKEN.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import {
  fetchPlatformProfile,
  hasActiveEntitlementForUser,
  KINETIX_PRODUCT_KEY,
} from '../src/lib/platformAuth'

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
const email = process.env.E2E_EMAIL
const accessToken = process.env.E2E_ACCESS_TOKEN

async function main() {
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
    process.exit(1)
  }
  if (!accessToken) {
    console.error('Set E2E_ACCESS_TOKEN in .env.local to run the full flow.')
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })

  console.log('1) Resolving user from access token...')
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
  if (userError) {
    console.error('Token validation failed:', userError.message)
    process.exit(1)
  }
  const userId = userData.user?.id
  if (!userId) {
    console.error('No user id found in E2E_ACCESS_TOKEN')
    process.exit(1)
  }
  console.log('   User id:', userId)
  if (email) {
    console.log('   Expected email:', email)
    console.log('   Token email:', userData.user?.email ?? '(none)')
  }

  console.log('2) Fetching platform profile...')
  const profile = await fetchPlatformProfile(supabase, userId)
  if (!profile) {
    console.error('Platform profile not found for this user.')
    process.exit(1)
  }
  console.log('   Profile id:', profile.id)

  console.log('3) Checking entitlement for', KINETIX_PRODUCT_KEY, '...')
  const entitled = await hasActiveEntitlementForUser(
    supabase,
    profile.id,
    KINETIX_PRODUCT_KEY,
    userId
  )
  console.log('   Entitled:', entitled)

  console.log('\nFull flow OK.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
