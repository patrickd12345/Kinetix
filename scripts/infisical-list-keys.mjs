#!/usr/bin/env node
/**
 * Read-only Infisical audit: prints environment, path, key count, and **key names only** (never values).
 * Requires `infisical login` (or machine identity) and `.infisical.json` workspaceId.
 *
 * Usage:
 *   node scripts/infisical-list-keys.mjs
 *   node scripts/infisical-list-keys.mjs --env prod
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { projectIdArgs, resolveInfisicalExecutable } from './infisical-merge-lib.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const envs = ['prod', 'dev']
const paths = ['/platform', '/kinetix']

const argv = process.argv.slice(2)
let onlyEnv = null
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--env' && argv[i + 1]) {
    onlyEnv = argv[++i]
    break
  }
}

const cfgPath = join(root, '.infisical.json')
if (!existsSync(cfgPath)) {
  console.error('Missing .infisical.json at repo root.')
  process.exit(2)
}

const cli = resolveInfisicalExecutable()

function exportKeys(envName, secretPath) {
  const args = [...projectIdArgs(), 'export', '--env', envName, '--path', secretPath, '--format', 'json']
  const out = execFileSync(cli, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const arr = JSON.parse(out)
  const keys = (Array.isArray(arr) ? arr : [])
    .map((e) => e.key || e.secretKey)
    .filter((k) => typeof k === 'string')
    .sort()
  return keys
}

for (const env of envs) {
  if (onlyEnv && env !== onlyEnv) continue
  for (const path of paths) {
    try {
      const keys = exportKeys(env, path)
      console.log(`[infisical CLI] env=${env} path=${path} key_count=${keys.length}`)
      console.log(`  keys: ${keys.join(', ')}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const stderr = err && typeof err === 'object' && 'stderr' in err ? String(err.stderr) : ''
      console.error(`[infisical CLI] FAIL env=${env} path=${path} :: ${stderr || msg}`)
    }
  }
}
