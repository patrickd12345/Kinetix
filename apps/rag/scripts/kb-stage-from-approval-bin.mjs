#!/usr/bin/env node
/**
 * Stage curated KB artifacts from kinetix.support_kb_approval_bin into a JSON file.
 *
 * Optional automation: this helps operators export approved/ingested drafts into
 * a corpus file for review or follow-up bulk ingest, while preserving ticket-first flow.
 *
 * Usage:
 *   node scripts/kb-stage-from-approval-bin.mjs --dry-run
 *   node scripts/kb-stage-from-approval-bin.mjs --out ../web/support-corpus/support-artifacts.staged.json
 *   node scripts/kb-stage-from-approval-bin.mjs --ingest --base-url=http://localhost:3001
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { createClient } from '@supabase/supabase-js'
import { validateSupportArtifactForIngest } from '../services/supportArtifact.js'

function parseArgs(argv) {
  let out = ''
  let baseUrl = process.env.KINETIX_RAG_BASE_URL?.trim() || 'http://localhost:3001'
  let statuses = 'approved,ingested'
  const ingest = argv.includes('--ingest')
  const dryRun = argv.includes('--dry-run') || !ingest

  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') {
      console.log(`Usage: kb-stage-from-approval-bin.mjs [options]

Options:
  --out=<path>          Output JSON file path
  --statuses=<csv>      Draft statuses to include (default: approved,ingested)
  --base-url=<url>      RAG base URL for --ingest (default: http://localhost:3001)
  --dry-run             Validate and report only (default when --ingest absent)
  --ingest              POST staged artifacts to /support/kb/ingest
`)
      process.exit(0)
    }
    if (arg.startsWith('--out=')) out = arg.slice('--out='.length).trim()
    if (arg.startsWith('--statuses=')) statuses = arg.slice('--statuses='.length).trim()
    if (arg.startsWith('--base-url=')) baseUrl = arg.slice('--base-url='.length).trim()
  }

  const statusSet = new Set(
    statuses
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  )
  const outputPath = out
    ? path.resolve(process.cwd(), out)
    : path.resolve(process.cwd(), '../web/support-corpus/support-artifacts.staged.json')

  return {
    outputPath,
    statusSet,
    ingest,
    dryRun,
    baseUrl: baseUrl.replace(/\/$/, ''),
  }
}

function requiredEnv(name) {
  const value = process.env[name]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required`)
  }
  return value.trim()
}

function toArtifact(draft) {
  return {
    artifact_id: String(draft.artifact_id),
    title: String(draft.title),
    excerpt: typeof draft.excerpt === 'string' && draft.excerpt.trim() ? draft.excerpt.trim() : undefined,
    body_markdown: String(draft.body_markdown),
    version: Number(draft.version ?? 1),
    review_status: 'approved',
    topic: String(draft.topic ?? 'general'),
    intent: String(draft.intent ?? 'troubleshoot'),
    source_type: String(draft.source_type ?? 'ticket_resolution'),
    product: 'kinetix',
    locale: String(draft.locale ?? 'en'),
    surface: String(draft.surface ?? 'web'),
  }
}

async function main() {
  const { outputPath, statusSet, ingest, dryRun, baseUrl } = parseArgs(process.argv.slice(2))
  const supabaseUrl = requiredEnv('SUPABASE_URL')
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .schema('kinetix')
    .from('support_kb_approval_bin')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(500)

  if (error) {
    throw new Error(`Failed to load approval drafts: ${error.message}`)
  }

  const rows = Array.isArray(data) ? data : []
  const staged = rows.filter((row) => statusSet.has(String(row.review_status ?? '')))
  const artifacts = staged.map(toArtifact)

  for (const [index, artifact] of artifacts.entries()) {
    const validated = validateSupportArtifactForIngest(artifact)
    if (!validated.ok) {
      throw new Error(`Invalid staged artifact at index ${index}: ${validated.errors.join('; ')}`)
    }
  }

  const outputJson = `${JSON.stringify(artifacts, null, 2)}\n`
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, outputJson, 'utf8')
  console.info(`Staged ${artifacts.length} artifact(s) into ${outputPath}`)

  if (dryRun || !ingest) {
    console.info('Dry run complete (--ingest not set).')
    return
  }

  let ok = 0
  for (const [index, artifact] of artifacts.entries()) {
    const res = await fetch(`${baseUrl}/support/kb/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifact }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Ingest failed at index ${index} (${res.status}): ${text}`)
    }
    ok += 1
  }
  console.info(`Ingested ${ok} staged artifact(s) into ${baseUrl}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
