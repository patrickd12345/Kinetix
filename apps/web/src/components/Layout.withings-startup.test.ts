import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Layout Withings startup sync policy', () => {
  it('does not run Withings sync on startup', () => {
    const file = readFileSync(resolve(process.cwd(), 'src/components/Layout.tsx'), 'utf-8')
    expect(file.includes('syncWithingsWeightsAtStartup')).toBe(false)
    expect(file.includes('WITHINGS_STARTUP_RETRY_DELAYS_MS')).toBe(false)
  })
})
