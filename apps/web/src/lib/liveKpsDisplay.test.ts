import { describe, expect, it } from 'vitest'

import {
  LIVE_KPS_CALIBRATION_SECONDS,
  LIVE_KPS_SMOOTHING_WINDOW_MS,
  appendLiveKpsSample,
  getLiveKpsDisplayState,
  getSmoothedLiveKps,
  type LiveKpsSample,
} from './liveKpsDisplay'

describe('liveKpsDisplay', () => {
  it('shows a calibration placeholder during the opening calibration window', () => {
    const state = getLiveKpsDisplayState({
      isRunning: true,
      durationSeconds: LIVE_KPS_CALIBRATION_SECONDS - 1,
      smoothedRelativeKps: 96.4,
    })

    expect(state.text).toBe('--')
    expect(state.label).toBe('Calibrating KPS')
    expect(state.numericValue).toBeNull()
    expect(state.isCalibrating).toBe(true)
  })

  it('keeps only the last three seconds of samples for smoothing', () => {
    const samples: LiveKpsSample[] = [
      { atMs: 8_000, value: 80 },
      { atMs: 9_500, value: 88 },
    ]

    const next = appendLiveKpsSample(samples, { atMs: 12_000, value: 92 })

    expect(next).toEqual([
      { atMs: 9_500, value: 88 },
      { atMs: 12_000, value: 92 },
    ])
    expect(next.every((sample) => 12_000 - sample.atMs <= LIVE_KPS_SMOOTHING_WINDOW_MS)).toBe(true)
  })

  it('averages recent live samples after calibration instead of showing the newest raw spike', () => {
    const smoothed = getSmoothedLiveKps([
      { atMs: 10_000, value: 84 },
      { atMs: 11_000, value: 90 },
      { atMs: 12_000, value: 96 },
    ])

    expect(smoothed).toBe(90)

    const state = getLiveKpsDisplayState({
      isRunning: true,
      durationSeconds: LIVE_KPS_CALIBRATION_SECONDS + 2,
      smoothedRelativeKps: smoothed,
    })

    expect(state.text).toBe('90')
    expect(state.label).toBe('Live KPS')
    expect(state.numericValue).toBe(90)
    expect(state.isCalibrating).toBe(false)
  })
})
