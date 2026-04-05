import { describe, it, expect } from 'vitest'
import {
  normalizeWithingsRedirectUri,
  resolveWithingsRedirectUriForOAuth,
  resolveWithingsRedirectUriForTokenExchange,
} from './withingsRedirectUri'

describe('withingsRedirectUri', () => {
  it('normalizeWithingsRedirectUri strips trailing slashes', () => {
    expect(normalizeWithingsRedirectUri('https://kinetix.bookiji.com/settings/')).toBe(
      'https://kinetix.bookiji.com/settings',
    )
    expect(normalizeWithingsRedirectUri('  https://x.com/settings  ')).toBe('https://x.com/settings')
  })

  it('resolveWithingsRedirectUriForOAuth prefers explicit over origin', () => {
    expect(
      resolveWithingsRedirectUriForOAuth({
        explicit: 'https://kinetix.bookiji.com/settings',
        origin: 'https://wrong.example.com',
      }),
    ).toBe('https://kinetix.bookiji.com/settings')
  })

  it('resolveWithingsRedirectUriForOAuth uses origin when explicit unset', () => {
    expect(
      resolveWithingsRedirectUriForOAuth({
        origin: 'https://kinetix.bookiji.com',
      }),
    ).toBe('https://kinetix.bookiji.com/settings')
  })

  it('resolveWithingsRedirectUriForTokenExchange prefers body over env', () => {
    expect(
      resolveWithingsRedirectUriForTokenExchange({
        bodyRedirectUri: 'https://a.com/settings',
        envRedirectUri: 'https://b.com/settings',
        requestOrigin: 'https://c.com',
      }),
    ).toBe('https://a.com/settings')
  })
})
