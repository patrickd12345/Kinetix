import { describe, expect, it } from 'vitest'
import { validateKbApprovalDraftPatch } from './supportQueueStore.js'

describe('validateKbApprovalDraftPatch', () => {
  it('accepts trimmed valid draft updates', () => {
    expect(
      validateKbApprovalDraftPatch({
        title: '  OAuth fix  ',
        body_markdown: '  # Steps  ',
        topic: 'sync',
        intent: 'howto',
        review_status: 'approved',
      }),
    ).toEqual({
      title: 'OAuth fix',
      body_markdown: '# Steps',
      topic: 'sync',
      intent: 'howto',
      review_status: 'approved',
    })
  })

  it('rejects unsupported topic values before the database layer', () => {
    expect(() => validateKbApprovalDraftPatch({ topic: 'random-topic' })).toThrow(
      'Draft topic must be one of: account, billing, sync, import, kps, charts, privacy, general',
    )
  })

  it('rejects blank markdown before the database layer', () => {
    expect(() => validateKbApprovalDraftPatch({ body_markdown: '   ' })).toThrow('Draft body markdown is required')
  })

  it('rejects excerpt that is too long', () => {
    expect(() => validateKbApprovalDraftPatch({ excerpt: 'x'.repeat(2001) })).toThrow('Draft excerpt must be at most')
  })

  it('accepts empty excerpt', () => {
    expect(validateKbApprovalDraftPatch({ excerpt: '' })).toEqual({ excerpt: '' })
  })
})
