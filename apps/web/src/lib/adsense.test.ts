import { describe, expect, it } from 'vitest'
import {
  adsenseApprovalModeFromEnv,
  adsenseClientFromEnv,
  adsenseSlotFromEnv,
  getAdsenseLoaderUrl,
  shouldLoadAdSenseScript,
  shouldShowAdSenseDisplayUnit,
} from './adsense'

describe('adsense env helpers', () => {
  it('does not load without client', () => {
    expect(shouldLoadAdSenseScript({})).toBe(false)
    expect(shouldLoadAdSenseScript({ VITE_ADSENSE_CLIENT: '   ' })).toBe(false)
  })

  it('loads when client set and not globally off', () => {
    expect(shouldLoadAdSenseScript({ VITE_ADSENSE_CLIENT: 'ca-pub-123' })).toBe(true)
  })

  it('does not load when globally off', () => {
    expect(
      shouldLoadAdSenseScript({ VITE_ADSENSE_CLIENT: 'ca-pub-123', VITE_ADSENSE_GLOBAL_OFF: 'true' }),
    ).toBe(false)
  })

  it('display unit requires client and slot', () => {
    expect(shouldShowAdSenseDisplayUnit({ VITE_ADSENSE_CLIENT: 'ca-pub-1' })).toBe(false)
    expect(
      shouldShowAdSenseDisplayUnit({ VITE_ADSENSE_CLIENT: 'ca-pub-1', VITE_ADSENSE_SLOT: '999' }),
    ).toBe(true)
  })

  it('trims client and slot', () => {
    expect(adsenseClientFromEnv({ VITE_ADSENSE_CLIENT: '  ca-pub-x  ' })).toBe('ca-pub-x')
    expect(adsenseSlotFromEnv({ VITE_ADSENSE_SLOT: '  slot  ' })).toBe('slot')
  })

  it('reads approval mode flag', () => {
    expect(adsenseApprovalModeFromEnv({ VITE_ADSENSE_APPROVAL_MODE: 'true' })).toBe(true)
    expect(adsenseApprovalModeFromEnv({})).toBe(false)
  })

  it('builds loader URL with client param', () => {
    expect(getAdsenseLoaderUrl('ca-pub-abc')).toContain('pagead2.googlesyndication.com')
    expect(getAdsenseLoaderUrl('ca-pub-abc')).toContain('client=ca-pub-abc')
  })
})
