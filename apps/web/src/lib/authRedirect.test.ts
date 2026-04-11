import { describe, expect, it } from 'vitest'
import { buildAuthRedirectTarget, resolveConfiguredAuthRedirectUrl } from './authRedirect'

describe('resolveConfiguredAuthRedirectUrl', () => {
  it('returns configured URL unchanged when not in dev', () => {
    expect(
      resolveConfiguredAuthRedirectUrl(
        'http://localhost:5173',
        'https://app.bookiji.com/login',
        false
      )
    ).toBe('https://app.bookiji.com/login')
  })

  it('drops a non-loopback pin when dev origin is localhost', () => {
    expect(
      resolveConfiguredAuthRedirectUrl(
        'http://localhost:5173',
        'https://app.bookiji.com/login',
        true
      )
    ).toBeNull()
    expect(
      resolveConfiguredAuthRedirectUrl(
        'http://127.0.0.1:5173',
        'https://kinetix.bookiji.com/login',
        true
      )
    ).toBeNull()
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
})
