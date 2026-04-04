import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { querySupportKB } from './supportRagClient'
import * as ragClient from './ragClient'

vi.mock('./ragClient', async () => {
  const actual = await vi.importActual<typeof import('./ragClient')>('./ragClient')
  return {
    ...actual,
    getRAGBaseUrl: vi.fn(),
  }
})

describe('querySupportKB', () => {
  beforeEach(() => {
    vi.mocked(ragClient.getRAGBaseUrl).mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns unavailable when RAG base URL cannot be resolved', async () => {
    vi.mocked(ragClient.getRAGBaseUrl).mockResolvedValue(null)
    const out = await querySupportKB('strava')
    expect(out).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('returns empty results for whitespace-only query without calling fetch', async () => {
    vi.mocked(ragClient.getRAGBaseUrl).mockResolvedValue('http://localhost:3001')
    const out = await querySupportKB('   ')
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.data.results).toEqual([])
  })

  it('POSTs to /support/kb/query and maps results', async () => {
    vi.mocked(ragClient.getRAGBaseUrl).mockResolvedValue('http://localhost:3001')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        collection: 'kinetix_support_kb',
        query: 'strava',
        topK: 5,
        filters: { topic: null },
        results: [
          {
            chunkId: 'x:v1:0',
            distance: 0.2,
            similarity: 0.83,
            document: 'Connect in Settings.',
            metadata: { title: 'Strava', topic: 'sync' },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const out = await querySupportKB('strava sync')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/support/kb/query',
      expect.objectContaining({
        method: 'POST',
      })
    )
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.data.results).toHaveLength(1)
      expect(out.data.results[0].metadata.title).toBe('Strava')
    }
  })

  it('returns http_error on non-OK response', async () => {
    vi.mocked(ragClient.getRAGBaseUrl).mockResolvedValue('http://localhost:3001')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      })
    )

    const out = await querySupportKB('test')
    expect(out).toEqual({ ok: false, reason: 'http_error', status: 500 })
  })

  it('treats 503 as unavailable', async () => {
    vi.mocked(ragClient.getRAGBaseUrl).mockResolvedValue('http://localhost:3001')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      })
    )

    const out = await querySupportKB('test')
    expect(out).toEqual({ ok: false, reason: 'unavailable' })
  })
})
