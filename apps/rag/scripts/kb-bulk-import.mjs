#!/usr/bin/env node
/**
 * Curated support KB bulk import helper (optional).
 *
 * - Validates artifacts with the same rules as POST /support/kb/ingest (no raw tickets).
 * - Default: --dry-run (validation only). Use --ingest to POST each artifact to a running RAG base URL.
 *
 * Usage:
 *   node scripts/kb-bulk-import.mjs --file ./curated-artifacts.json --dry-run
 *   KINETIX_RAG_BASE_URL=http://localhost:3001 node scripts/kb-bulk-import.mjs --file ./curated-artifacts.json --ingest
 *
 * File format: JSON array of artifact objects (same shape as `artifact` in POST /support/kb/ingest).
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { validateSupportArtifactForIngest } from '../services/supportArtifact.js'

function parseArgs(argv) {
  const fileFlag = argv.indexOf('--file')
  const file = fileFlag >= 0 ? argv[fileFlag + 1] : ''
  return {
    file,
    dryRun: argv.includes('--dry-run') || !argv.includes('--ingest'),
    ingest: argv.includes('--ingest'),
  }
}

async function main() {
  const { file, dryRun, ingest } = parseArgs(process.argv)
  if (!file) {
    console.error('Usage: node scripts/kb-bulk-import.mjs --file <json> [--dry-run|--ingest]')
    process.exit(2)
  }

  const resolved = path.resolve(process.cwd(), file)
  const raw = fs.readFileSync(resolved, 'utf8')
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error('Input JSON must be an array of artifacts')
  }

  const seen = new Set()
  for (const [index, artifact] of parsed.entries()) {
    if (artifact && typeof artifact === 'object' && seen.has(artifact.artifact_id)) {
      throw new Error(`Duplicate artifact_id at index ${index}: ${artifact.artifact_id}`)
    }
    if (artifact && typeof artifact === 'object' && artifact.artifact_id) {
      seen.add(artifact.artifact_id)
    }

    const validated = validateSupportArtifactForIngest(artifact)
    if (!validated.ok) {
      throw new Error(`Invalid artifact at index ${index}: ${validated.errors.join('; ')}`)
    }
  }

  console.info(`Validated ${parsed.length} curated artifact(s).`)

  if (dryRun || !ingest) {
    console.info('Dry run complete (--ingest not set).')
    return
  }

  const baseUrl = (process.env.KINETIX_RAG_BASE_URL || 'http://localhost:3001').replace(/\/$/, '')
  let ok = 0
  for (const [index, artifact] of parsed.entries()) {
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

  console.info(`Ingested ${ok} artifact(s) into ${baseUrl}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
