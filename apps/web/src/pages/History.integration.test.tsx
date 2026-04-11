import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'History.tsx'), 'utf8')

describe('History remediation contracts', () => {
  it('uses the logical delete API instead of hard-deleting runs', () => {
    expect(source).toContain('hideRun(id)')
    expect(source).not.toContain('db.runs.delete')
  })

  it('keeps history action icon buttons accessible', () => {
    expect(source).toContain('aria-label={`Analyze ${runDisplayTitle(run)} with AI coach`}')
    expect(source).toContain('aria-label={`Delete ${runDisplayTitle(run)}`}')
    expect(source).toContain('type="button"')
  })

  it('does not import the lazy Coaching route from History', () => {
    expect(source).toContain("from '../components/HistoryCoachSummary'")
    expect(source).not.toContain("from './Coaching'")
  })
})
