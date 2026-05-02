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
    expect(source).not.toContain("fetch('/api/strava-refresh'")
    expect(source).not.toMatch(/refreshToken[\s\S]{0,160}\/api\//)
    expect(source).not.toMatch(/refresh_token/)
  })

  it('does not expose Kinetix-managed provider tokens to browser responses or state', () => {
    const clientSources = [
      'apps/web/src/hooks/useStravaAuth.ts',
      'apps/web/src/hooks/useWithingsAuth.ts',
      'apps/web/src/lib/withings.ts',
      'apps/web/src/lib/integrations/withings/oauth.ts',
    ]

    for (const source of clientSources) {
      expect(read(source), `${source} exposes provider token fields`).not.toMatch(
        /\b(access_token|refresh_token|accessToken|refreshToken)\b/,
      )
    }

    const apiSources = ['api/strava-oauth/index.ts', 'api/strava-refresh/index.ts', 'api/withings/index.ts']
    for (const source of apiSources) {
      expect(read(source), `${source} serializes provider tokens to the browser`).not.toMatch(
        /json\(\s*{[\s\S]{0,300}\b(access_token|refresh_token)\b/,
      )
    }
  })
})
