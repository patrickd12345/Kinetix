#!/usr/bin/env node
/**
 * Bulk-ingest support-artifacts.json into kinetix_support_kb via POST /support/kb/ingest.
 * Does not transform artifacts — each JSON object is sent as { artifact }.
 *
 * Usage:
 *   node apps/web/support-corpus/ingest-corpus.mjs
 *   KINETIX_RAG_BASE_URL=http://localhost:3001 node apps/web/support-corpus/ingest-corpus.mjs
 *   node apps/web/support-corpus/ingest-corpus.mjs --base-url=http://localhost:3001 --corpus=./support-artifacts.json
 *
 * Exit code 1 if any ingest fails or the corpus file is invalid.
 */
import fs from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  let baseUrl = process.env.KINETIX_RAG_BASE_URL?.trim() || process.env.RAG_BASE_URL?.trim() || ''
  let corpusArg = ''

  for (const a of argv) {
    if (a === '-h' || a === '--help') {
      console.log(`Usage: ingest-corpus.mjs [--base-url=<url>] [--corpus=<path>]

Environment:
  KINETIX_RAG_BASE_URL / RAG_BASE_URL   RAG service base (default: http://localhost:3001)

Posts each artifact from support-artifacts.json to {base}/support/kb/ingest`)
      process.exit(0)
    }
    if (a.startsWith('--base-url=')) baseUrl = a.slice('--base-url='.length).trim()
    if (a.startsWith('--corpus=')) corpusArg = a.slice('--corpus='.length).trim()
  }

  if (!baseUrl) baseUrl = 'http://localhost:3001'
  baseUrl = baseUrl.replace(/\/$/, '')

  const corpusPath = corpusArg
    ? resolve(process.cwd(), corpusArg)
    : join(__dirname, 'support-artifacts.json')

  return { baseUrl, corpusPath }
}

const { baseUrl, corpusPath } = parseArgs(process.argv.slice(2))
const ingestUrl = `${baseUrl}/support/kb/ingest`

let raw
try {
  raw = fs.readFileSync(corpusPath, 'utf8')
} catch (e) {
  console.error(`Cannot read corpus: ${corpusPath}`, e instanceof Error ? e.message : e)
  process.exit(1)
}

let artifacts
try {
  artifacts = JSON.parse(raw)
} catch (e) {
  console.error('Invalid JSON in corpus file:', e instanceof Error ? e.message : e)
  process.exit(1)
}

if (!Array.isArray(artifacts)) {
  console.error('Corpus must be a JSON array of artifacts.')
  process.exit(1)
}

console.log(`RAG base: ${baseUrl}`)
console.log(`Corpus:   ${corpusPath}`)
console.log(`Ingest:   ${ingestUrl}`)
console.log(`Artifacts: ${artifacts.length}`)
console.log('')

let ok = 0
let fail = 0

for (let i = 0; i < artifacts.length; i++) {
  const artifact = artifacts[i]
  const id = typeof artifact?.artifact_id === 'string' ? artifact.artifact_id : `(index ${i})`
  try {
    const res = await fetch(ingestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifact }),
      signal: AbortSignal.timeout(60_000),
    })

    const text = await res.text()
    let body
    try {
      body = text ? JSON.parse(text) : {}
    } catch {
      body = { raw: text }
    }

    if (!res.ok) {
      fail++
      console.error(`FAIL ${id}  HTTP ${res.status}  ${typeof body.error === 'string' ? body.error : text.slice(0, 500)}`)
      continue
    }

    if (body.success !== true) {
      fail++
      console.error(`FAIL ${id}  response missing success: true`, JSON.stringify(body).slice(0, 300))
      continue
    }

    ok++
    const chunk = body.chunkId != null ? ` chunkId=${body.chunkId}` : ''
    console.log(`OK   ${id}${chunk}`)
  } catch (e) {
    fail++
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`FAIL ${id}  ${msg}`)
  }
}

console.log('')
console.log(`Summary: ${ok} ok, ${fail} failed (total ${artifacts.length})`)

if (fail > 0) {
  process.exit(1)
}
