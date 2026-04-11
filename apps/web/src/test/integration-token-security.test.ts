import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

function read(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

describe('integration token hygiene', () => {
  it('does not log credential-bearing token fields in integration sources', () => {
    const sources = [
      'apps/web/src/lib/strava.ts',
      'apps/web/src/lib/withings.ts',
      'apps/web/src/store/settingsStore.ts',
      'apps/web/src/pages/Settings.tsx',
    ]

    for (const source of sources) {
      const lines = read(source).split(/\r?\n/)
      const suspicious = lines.filter(
        (line) =>
          /console\.(log|warn|error|info|debug)/.test(line) &&
          /(accessToken|refreshToken|access_token|refresh_token|Authorization|stravaCredentials|withingsCredentials)/.test(line),
      )
      expect(suspicious, `${source} logs credential-bearing fields`).toEqual([])
    }
  })

  it('keeps Strava refresh token transport scoped to the refresh proxy', () => {
    const source = read('apps/web/src/lib/strava.ts')
    expect(source).toContain("fetch('/api/strava-refresh'")
    expect(source).not.toMatch(/refreshToken[\s\S]{0,160}\/api\/(ai|rag|support|operator)/)
  })
})
