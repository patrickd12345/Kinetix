import { describe, expect, it, vi } from 'vitest'
import {
  buildEscalationMailtoHref,
  buildSupportEscalationPayload,
  buildTicketPayloadMailtoHref,
  formatEscalationBodyPlain,
  retrievalStateForPayload,
} from './helpCenterEscalation'

describe('helpCenterEscalation', () => {
  it('retrievalStateForPayload maps failures and result quality', () => {
    expect(retrievalStateForPayload({ ok: false, reason: 'unavailable' })).toBe('service_unavailable')
    expect(retrievalStateForPayload({ ok: false, reason: 'http_error', status: 500 })).toBe('query_failed')
    expect(
      retrievalStateForPayload({
        ok: true,
        data: {
          collection: 'kinetix_support_kb',
          query: 'q',
          topK: 5,
          filters: { topic: null },
          results: [],
        },
      })
    ).toBe('retrieval_empty')
    expect(
      retrievalStateForPayload({
        ok: true,
        data: {
          collection: 'kinetix_support_kb',
          query: 'q',
          topK: 5,
          filters: { topic: null },
          results: [
            {
              chunkId: 'c1',
              distance: 1,
              similarity: 0.05,
              document: 'x',
              metadata: { title: 'T' },
            },
          ],
        },
      })
    ).toBe('retrieval_weak')
    expect(
      retrievalStateForPayload({
        ok: true,
        data: {
          collection: 'kinetix_support_kb',
          query: 'q',
          topK: 5,
          filters: { topic: null },
          results: [
            {
              chunkId: 'c1',
              distance: 0.1,
              similarity: 0.9,
              document: 'x',
              metadata: { title: 'T' },
            },
          ],
        },
      })
    ).toBe('retrieval_useful')
  })

  it('formatEscalationBodyPlain includes structured fields and KB refs', () => {
    const payload = buildSupportEscalationPayload({
      userQuery: 'strava sync',
      supportOutcome: {
        ok: true,
        data: {
          collection: 'kinetix_support_kb',
          query: 'strava sync',
          topK: 5,
          filters: { topic: null },
          results: [
            {
              chunkId: 'a:v1:0',
              distance: 0.2,
              similarity: 0.12,
              document: 'body',
              metadata: { title: 'Strava doc' },
            },
          ],
        },
      },
      route: '/help',
      userIdOpaque: 'user-abc',
      fallbackGuidanceShown: true,
    })
    const body = formatEscalationBodyPlain(payload)
    expect(body).toContain('product: kinetix')
    expect(body).toContain('surface: web')
    expect(body).toContain('route: /help')
    expect(body).toContain('user_id_opaque: user-abc')
    expect(body).toContain('retrieval_state: retrieval_weak')
    expect(body).toContain('fallback_guidance_shown: yes')
    expect(body).toContain('user_query: strava sync')
    expect(body).toContain('chunk_id=a:v1:0')
    expect(body).toContain('title=Strava doc')
  })

  it('buildTicketPayloadMailtoHref encodes JSON body', () => {
    const href = buildTicketPayloadMailtoHref('support@test.dev', {
      product: 'kinetix',
      issueSummary: 'test',
    })
    expect(href.startsWith('mailto:support@test.dev?')).toBe(true)
    const qs = href.slice(href.indexOf('?') + 1)
    const params = new URLSearchParams(qs)
    expect(params.get('body')).toContain('"issueSummary": "test"')
  })

  it('buildEscalationMailtoHref encodes subject and body', () => {
    vi.stubEnv('VITE_APP_VERSION', '1.2.3')
    try {
      const payload = buildSupportEscalationPayload({
        userQuery: 'help',
        supportOutcome: { ok: false, reason: 'unavailable' },
        route: '/help',
        userIdOpaque: null,
        fallbackGuidanceShown: true,
      })
      const href = buildEscalationMailtoHref('support@test.dev', payload)
      expect(href.startsWith('mailto:support@test.dev?')).toBe(true)
      const qs = href.slice(href.indexOf('?') + 1)
      const params = new URLSearchParams(qs)
      expect(params.get('subject')).toContain('[Kinetix web] Support')
      const body = params.get('body')
      expect(body).toContain('retrieval_state: service_unavailable')
      expect(body).toContain('app_version: 1.2.3')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
