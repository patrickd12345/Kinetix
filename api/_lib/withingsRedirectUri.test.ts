import { describe, it, expect } from 'vitest'
import {
  normalizeWithingsRedirectUri,
  resolveWithingsRedirectUriForOAuth,
  resolveWithingsRedirectUriForTokenExchange,
} from './withingsRedirectUri'

describe('withingsRedirectUri', () => {
  it('normalizeWithingsRedirectUri strips trailing slashes', () => {
    expect(normalizeWithingsRedirectUri('https://kinetix.bookiji.com/api/withings-oauth/')).toBe(
      'https://kinetix.bookiji.com/api/withings-oauth',
    )
    expect(normalizeWithingsRedirectUri('  https://x.com/api/withings-oauth  ')).toBe(
      'https://x.com/api/withings-oauth',
    )
  })

  it('resolveWithingsRedirectUriForOAuth prefers explicit over origin', () => {
    expect(
      resolveWithingsRedirectUriForOAuth({
        explicit: 'https://kinetix.bookiji.com/api/withings-oauth',
        origin: 'https://wrong.example.com',
      }),
    ).toBe('https://kinetix.bookiji.com/api/withings-oauth')
  })

  it('resolveWithingsRedirectUriForOAuth uses origin when explicit unset', () => {
    expect(
      resolveWithingsRedirectUriForOAuth({
        origin: 'https://kinetix.bookiji.com',
      }),
    ).toBe('https://kinetix.bookiji.com/api/withings-oauth')
  })

  it('resolveWithingsRedirectUriForTokenExchange prefers body over env', () => {
    expect(
      resolveWithingsRedirectUriForTokenExchange({
        bodyRedirectUri: 'https://a.com/api/withings-oauth',
        envRedirectUri: 'https://b.com/api/withings-oauth',
        requestOrigin: 'https://c.com',
      }),
    ).toBe('https://a.com/api/withings-oauth')
  })

  it('resolveWithingsRedirectUriForTokenExchange falls back to callback endpoint from origin', () => {
    expect(
      resolveWithingsRedirectUriForTokenExchange({
        requestOrigin: 'https://kinetix.bookiji.com',
      }),
    ).toBe('https://kinetix.bookiji.com/api/withings-oauth')
  })
})
