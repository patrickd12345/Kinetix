/**
 * Validates apps/web/support-corpus/support-artifacts.json against supportArtifact.js rules.
 * Run from repo root: node apps/web/support-corpus/validate-corpus.mjs
 * Or: cd apps/web/support-corpus && node validate-corpus.mjs
 */
import fs from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { validateSupportArtifactForIngest } from '../../rag/services/supportArtifact.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const jsonPath = join(__dirname, 'support-artifacts.json')
const raw = fs.readFileSync(jsonPath, 'utf8')
const artifacts = JSON.parse(raw)

if (!Array.isArray(artifacts)) {
  console.error('support-artifacts.json must be a JSON array')
  process.exit(1)
}

let failed = 0
for (const a of artifacts) {
  const r = validateSupportArtifactForIngest(a)
  if (!r.ok) {
    failed++
    console.error(`FAIL ${a?.artifact_id ?? '?'}:`, r.errors.join('; '))
  }
}

if (failed > 0) {
  console.error(`\n${failed} artifact(s) invalid`)
  process.exit(1)
}

console.log(`OK: ${artifacts.length} artifacts validated`)
