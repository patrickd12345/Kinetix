import { describe, it, expect } from 'vitest'
import {
  coachMemoryStorageKey,
  oauthDedupeSessionKey,
  ragBannerDismissedSessionKey,
  ragFailStreakSessionKey,
  scopedSettingsLocalStorageKey,
} from './clientStorageScope'

describe('clientStorageScope', () => {
  const uid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  it('builds deterministic scoped settings key', () => {
    expect(scopedSettingsLocalStorageKey(uid)).toBe(`kinetix-settings:${uid}`)
  })

  it('builds deterministic coach memory key', () => {
    expect(coachMemoryStorageKey(uid)).toBe(`kinetix-coach-memory-v1:${uid}`)
  })

  it('scopes rag session keys', () => {
    expect(ragFailStreakSessionKey(uid)).toBe(`kinetix_rag_sync_fail_streak:${uid}`)
    expect(ragBannerDismissedSessionKey(uid)).toBe(`kinetix_rag_sync_banner_dismissed:${uid}`)
  })

  it('scopes oauth dedupe keys', () => {
    expect(oauthDedupeSessionKey('strava', uid)).toBe(`strava_oauth_code:${uid}`)
    expect(oauthDedupeSessionKey('withings', uid)).toBe(`withings_oauth_code:${uid}`)
  })
})
