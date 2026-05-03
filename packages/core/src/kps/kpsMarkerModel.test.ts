import { describe, expect, it } from 'vitest'
import { captureKpsMarker, type KpsMarker } from './kpsMarkerModel'

describe('kpsMarkerModel', () => {
  it('does not capture before 1km', () => {
    const markers: KpsMarker[] = []
    const result = captureKpsMarker(markers, 0.99, 300, 50, 300, new Date().toISOString())
    expect(result).toHaveLength(0)
  })

  it('captures at 1km and avoids duplicates', () => {
    const markers: KpsMarker[] = []
    const t1 = new Date().toISOString()
    const result1 = captureKpsMarker(markers, 1.05, 300, 55, 300, t1)

    expect(result1).toHaveLength(1)
    expect(result1[0]).toMatchObject({
      kmIndex: 1,
      elapsedSec: 300,
      splitSec: 300,
      liveKps: 55
    })

    const result2 = captureKpsMarker(result1, 1.1, 310, 55, 300, new Date().toISOString())
    expect(result2).toHaveLength(1)
  })

  it('captures sequential splits correctly', () => {
    let markers: KpsMarker[] = []

    markers = captureKpsMarker(markers, 1.0, 300, 50, 300, new Date().toISOString())
    expect(markers).toHaveLength(1)
    expect(markers[0].splitSec).toBe(300)

    markers = captureKpsMarker(markers, 2.05, 620, 52, 310, new Date().toISOString())
    expect(markers).toHaveLength(2)
    expect(markers[1].splitSec).toBe(320) // 620 - 300
    expect(markers[1].kmIndex).toBe(2)
  })
})
