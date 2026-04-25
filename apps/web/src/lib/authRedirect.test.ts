import { describe, expect, it } from 'vitest'
import { buildAuthRedirectTarget, resolveConfiguredAuthRedirectUrl } from './authRedirect'

describe('resolveConfiguredAuthRedirectUrl', () => {
  it('drops configured URL when Bookiji host points to non-Kinetix host', () => {
    expect(
      resolveConfiguredAuthRedirectUrl(
        'https://app.bookiji.com',
        'https://app.bookiji.com/login',
        false
      )
    ).toBeNull()
  })

  it('accepts configured URL when Bookiji host points to Kinetix host', () => {
    expect(
      resolveConfiguredAuthRedirectUrl(
        'https://app.bookiji.com',
        'https://kinetix.bookiji.com/login',
        false
      )
    ).toBe('https://kinetix.bookiji.com/login')
  })

  it('drops configured URL when it points to another origin outside Bookiji hosts', () => {
    expect(
      resolveConfiguredAuthRedirectUrl(
        'http://localhost:5173',
        'https://app.bookiji.com/login',
        false
      )
    ).toBeNull()
  })

  it('returns configured URL unchanged when origin matches (even outside dev)', () => {
    expect(
      resolveConfiguredAuthRedirectUrl(
        'https://kinetix.bookiji.com',
        'https://kinetix.bookiji.com/login',
        false
      )
    ).toBe('https://kinetix.bookiji.com/login')
  })

  it('keeps a loopback pin in dev when origin is localhost', () => {
    expect(
      resolveConfiguredAuthRedirectUrl(
        'http://localhost:5173',
        'http://localhost:5173/login',
        true
      )
    ).toBe('http://localhost:5173/login')
  })

  it('passes through when configured URL is empty', () => {
    expect(resolveConfiguredAuthRedirectUrl('http://localhost:5173', '', true)).toBe('')
    expect(resolveConfiguredAuthRedirectUrl('http://localhost:5173', undefined, true)).toBeUndefined()
  })
})

describe('buildAuthRedirectTarget', () => {
  it('uses window origin when configured URL is null', () => {
    expect(
      buildAuthRedirectTarget({
        windowOrigin: 'http://localhost:5173',
        configuredRedirectUrl: null,
        nextPath: '/history',
      })
    ).toBe('http://localhost:5173/login?next=%2Fhistory')
  })

  it('uses Kinetix canonical origin when login starts on app.bookiji.com', () => {
    expect(
      buildAuthRedirectTarget({
        windowOrigin: 'https://app.bookiji.com',
        configuredRedirectUrl: null,
        nextPath: '/history',
      })
    ).toBe('https://kinetix.bookiji.com/login?next=%2Fhistory')
  })

  it('ignores non-Kinetix configured redirects when login starts on a Bookiji host', () => {
    expect(
      buildAuthRedirectTarget({
        windowOrigin: 'https://app.bookiji.com',
        configuredRedirectUrl: 'https://app.bookiji.com/login',
        nextPath: '/history',
      })
    ).toBe('https://kinetix.bookiji.com/login?next=%2Fhistory')
  })
})
