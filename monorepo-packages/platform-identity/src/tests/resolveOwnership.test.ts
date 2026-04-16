import { describe, it, expect } from 'vitest'
import { resolveOwnership } from '../resolveOwnership.js'

describe('resolveOwnership', () => {
  it('should default all products to false', () => {
    const result = resolveOwnership({})
    expect(result).toEqual({
      kinetix: false,
      myassist: false,
      mychesscoach: false,
      bookiji: false,
    })
  })

  it('should map direct string entitlements correctly for single products', () => {
    const result = resolveOwnership({ entitlements: ['kinetix_pro'] })
    expect(result).toEqual({
      kinetix: true,
      myassist: false,
      mychesscoach: false,
      bookiji: false,
    })
  })

  it('should map direct string entitlements correctly for multiple products (bundle-like)', () => {
    const result = resolveOwnership({
      entitlements: ['kinetix_pro', 'myassist_pro']
    })
    expect(result).toEqual({
      kinetix: true,
      myassist: true,
      mychesscoach: false,
      bookiji: false,
    })

    const resultAll = resolveOwnership({
      entitlements: ['kinetix_pro', 'myassist_pro', 'mychesscoach_pro']
    })
    expect(resultAll).toEqual({
      kinetix: true,
      myassist: true,
      mychesscoach: true,
      bookiji: false,
    })
  })

  it('should not allow Spine entitlements to map to Bookiji', () => {
    const result = resolveOwnership({
      entitlements: ['bookiji_pro']
    })
    expect(result).toEqual({
      kinetix: false,
      myassist: false,
      mychesscoach: false,
      bookiji: false,
    })
  })

  it('should apply external ownership overrides including Bookiji', () => {
    const result = resolveOwnership({
      externalOwnership: {
        bookiji: true,
        myassist: true
      }
    })
    expect(result).toEqual({
      kinetix: false,
      myassist: true,
      mychesscoach: false,
      bookiji: true,
    })
  })

  it('should allow external ownership to override Spine entitlements (e.g. revoke access)', () => {
    const result = resolveOwnership({
      entitlements: ['kinetix_pro'],
      externalOwnership: {
        kinetix: false
      }
    })
    expect(result).toEqual({
      kinetix: false,
      myassist: false,
      mychesscoach: false,
      bookiji: false,
    })
  })
})
