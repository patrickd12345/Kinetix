import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchRecentWithingsWeights } from './withings'

/** kg 80.0 at unit -2 → value 8000 */
function grp(dateUnix: number, value: number) {
  return {
    date: dateUnix,
    measures: [{ type: 1, value, unit: -2 }],
  }
}

describe('fetchRecentWithingsWeights', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-03T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('merges paginated getmeas pages (more=1 uses offset on next request)', async () => {
    const page1 = {
      status: 0,
      body: {
        measuregrps: [grp(1_700_000_000, 8000)],
        more: 1,
        offset: 50,
      },
    }
    const page2 = {
      status: 0,
      body: {
        measuregrps: [grp(1_800_000_000, 8100)],
        more: 0,
        offset: 0,
      },
    }

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const entries = await fetchRecentWithingsWeights('tok', 30)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstBody = (fetchMock.mock.calls[0][1] as RequestInit)?.body as string
    expect(firstBody).toContain('category=1')
    expect(firstBody).toContain('startdate=')
    const secondBody = (fetchMock.mock.calls[1][1] as RequestInit)?.body as string
    expect(secondBody).toContain('offset=50')
    expect(entries).toHaveLength(2)
    expect(entries[0].dateUnix).toBe(1_800_000_000)
    expect(entries[0].kg).toBe(81)
    expect(entries[1].kg).toBe(80)
  })
})
