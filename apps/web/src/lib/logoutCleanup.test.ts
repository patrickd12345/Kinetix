import { beforeEach, describe, expect, it } from 'vitest'
import {
  oauthDedupeSessionKey,
  ragBannerDismissedSessionKey,
  ragFailStreakSessionKey,
} from './clientStorageScope'
import { clearLogoutSessionArtifacts } from './logoutCleanup'

describe('clearLogoutSessionArtifacts', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('clears volatile session artifacts for the signing-out user only', () => {
    const currentUser = 'user-a'
    const otherUser = 'user-b'

    sessionStorage.setItem(oauthDedupeSessionKey('strava', currentUser), 'code-a')
    sessionStorage.setItem(oauthDedupeSessionKey('withings', currentUser), 'code-a')
    sessionStorage.setItem(ragFailStreakSessionKey(currentUser), '3')
    sessionStorage.setItem(ragBannerDismissedSessionKey(currentUser), '1')
    sessionStorage.setItem(oauthDedupeSessionKey('strava', otherUser), 'code-b')
    sessionStorage.setItem(ragFailStreakSessionKey(otherUser), '1')

    clearLogoutSessionArtifacts(currentUser)

    expect(sessionStorage.getItem(oauthDedupeSessionKey('strava', currentUser))).toBeNull()
    expect(sessionStorage.getItem(oauthDedupeSessionKey('withings', currentUser))).toBeNull()
    expect(sessionStorage.getItem(ragFailStreakSessionKey(currentUser))).toBeNull()
    expect(sessionStorage.getItem(ragBannerDismissedSessionKey(currentUser))).toBeNull()
    expect(sessionStorage.getItem(oauthDedupeSessionKey('strava', otherUser))).toBe('code-b')
    expect(sessionStorage.getItem(ragFailStreakSessionKey(otherUser))).toBe('1')
  })
})
