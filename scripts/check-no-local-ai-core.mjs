#!/usr/bin/env node
/**
 * Guardrail: `packages/` must only contain `@kinetix/core` (`packages/core`).
 * All `@bookiji-inc/*` implementations live under `monorepo-packages/*` so PNPM cannot resolve stubs.
 */
import fs from 'fs'
import path from 'path'

const kinetixRoot = process.cwd()
const packagesDir = path.join(kinetixRoot, 'packages')
const allowed = new Set(['core'])

if (!fs.existsSync(packagesDir)) {
  process.exit(0)
}

for (const name of fs.readdirSync(packagesDir)) {
  if (name.startsWith('.')) continue
  const p = path.join(packagesDir, name)
  if (!fs.statSync(p).isDirectory()) continue
  if (!allowed.has(name)) {
    console.error(
      `ERROR: packages/${name} must not exist. Only packages/core is allowed under packages/. ` +
        `Remove stub/shadow copies; @bookiji-inc packages belong in monorepo-packages/.`
    )
    process.exit(1)
  }
}
