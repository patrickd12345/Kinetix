import { describe, expect, it } from 'vitest'
import { aggregateEntitlementPayload, isEntitlementRowActive, parseProductKey } from './platformEntitlements'

describe('platformEntitlements', () => {
  it('parseProductKey accepts spine keys only', () => {
    expect(parseProductKey('kinetix')).toBe('kinetix')
    expect(parseProductKey('KINETIX')).toBe('kinetix')
    expect(parseProductKey(undefined)).toBe(null)
    expect(parseProductKey('')).toBe(null)
    expect(parseProductKey('other')).toBe(null)
  })

  it('isEntitlementRowActive respects ends_at', () => {
    const past = new Date(Date.now() - 86400_000).toISOString()
    expect(isEntitlementRowActive({ active: true, ends_at: past })).toBe(false)
    const future = new Date(Date.now() + 86400_000).toISOString()
    expect(isEntitlementRowActive({ active: true, ends_at: future })).toBe(true)
  })

  it('aggregateEntitlementPayload merges active rows', () => {
    expect(aggregateEntitlementPayload([])).toEqual({ active: false, ends_at: null, source: null })

    const t1 = new Date(Date.now() + 100_000).toISOString()
    const t2 = new Date(Date.now() + 200_000).toISOString()

    expect(
      aggregateEntitlementPayload([
        { active: true, ends_at: t1, source: 'manual' },
        { active: true, ends_at: t2, source: 'stripe' },
      ]),
    ).toEqual({
      active: true,
      ends_at: t2,
      source: 'stripe',
    })
  })

  it('aggregateEntitlementPayload handles lifetime active (no ends)', () => {
    expect(
      aggregateEntitlementPayload([{ active: true, source: 'manual' }]),
    ).toEqual({
      active: true,
      ends_at: null,
      source: 'manual',
    })
  })
})
