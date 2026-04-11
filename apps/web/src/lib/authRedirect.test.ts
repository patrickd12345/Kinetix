import { describe, expect, it } from 'vitest'
import { buildAuthRedirectTarget } from './authRedirect'

describe('buildAuthRedirectTarget', () => {
  it('uses /login on current origin when no env override', () => {
    expect(
      buildAuthRedirectTarget({
        windowOrigin: 'https://kinetix.bookiji.com',
        configuredRedirectUrl: null,
      })
    ).toBe('https://kinetix.bookiji.com/login')
  })

  it('appends next query when provided', () => {
    const url = buildAuthRedirectTarget({
      windowOrigin: 'https://kinetix.bookiji.com',
      configuredRedirectUrl: null,
      nextPath: '/chat',
    })
    expect(url).toBe('https://kinetix.bookiji.com/login?next=%2Fchat')
  })

  it('pins callback to configured absolute URL (production Kinetix)', () => {
    expect(
      buildAuthRedirectTarget({
        windowOrigin: 'https://app.bookiji.com',
        configuredRedirectUrl: 'https://kinetix.bookiji.com/login',
      })
    ).toBe('https://kinetix.bookiji.com/login')
  })

  it('normalizes configured origin-only URL to /login', () => {
    expect(
      buildAuthRedirectTarget({
        windowOrigin: 'https://app.bookiji.com',
        configuredRedirectUrl: 'https://kinetix.bookiji.com',
        nextPath: '/',
      })
    ).toBe('https://kinetix.bookiji.com/login?next=%2F')
  })

  it('falls back to default login when configured URL is invalid', () => {
    expect(
      buildAuthRedirectTarget({
        windowOrigin: 'https://kinetix.bookiji.com',
        configuredRedirectUrl: 'not-a-valid-url',
      })
    ).toBe('https://kinetix.bookiji.com/login')
  })
})
