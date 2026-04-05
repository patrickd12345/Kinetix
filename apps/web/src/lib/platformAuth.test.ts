import { describe, expect, it, vi } from 'vitest'
import { hasActiveEntitlementForUser, KINETIX_PRODUCT_KEY } from './platformAuth'

function makeSupabaseMock(
  eqImpl: (column: string, value: string) => Promise<{ data: unknown[] | null; error: unknown | null }>
) {
  return {
    schema: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(eqImpl),
        })),
      })),
    })),
  }
}

describe('hasActiveEntitlementForUser', () => {
  it('returns true when user_id query succeeds with active kinetix entitlement', async () => {
    const supabase = makeSupabaseMock(async () => ({
      data: [{ product_key: 'kinetix', status: 'active', active: true }],
      error: null,
    }))

    const entitled = await hasActiveEntitlementForUser(
      supabase as never,
      'profile-1',
      KINETIX_PRODUCT_KEY,
      'user-1'
    )

    expect(entitled).toBe(true)
  })

  it('falls back to profile_id when user_id column is missing', async () => {
    const eqImpl = vi.fn(async (column: string) => {
      if (column === 'user_id') {
        return {
          data: null,
          error: { code: '42703', message: 'column entitlements.user_id does not exist' },
        }
      }

      return {
        data: [{ product_key: 'kinetix', status: 'active', active: true }],
        error: null,
      }
    })
    const supabase = makeSupabaseMock(eqImpl)

    const entitled = await hasActiveEntitlementForUser(
      supabase as never,
      'profile-1',
      KINETIX_PRODUCT_KEY,
      'user-1'
    )

    expect(entitled).toBe(true)
    expect(eqImpl).toHaveBeenCalledTimes(2)
    expect(eqImpl).toHaveBeenNthCalledWith(1, 'user_id', 'user-1')
    expect(eqImpl).toHaveBeenNthCalledWith(2, 'profile_id', 'profile-1')
  })

  it('throws on non-schema errors', async () => {
    const supabase = makeSupabaseMock(async () => ({
      data: null,
      error: { code: '42501', message: 'permission denied for table entitlements' },
    }))

    await expect(
      hasActiveEntitlementForUser(
        supabase as never,
        'profile-1',
        KINETIX_PRODUCT_KEY,
        'user-1'
      )
    ).rejects.toThrow('Failed to load entitlements: permission denied for table entitlements (42501)')
  })
})
