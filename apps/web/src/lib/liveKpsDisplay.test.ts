import { describe, expect, it } from 'vitest'

import {
  LIVE_KPS_SMOOTHING_WINDOW_MS,
  appendLiveKpsSample,
  getLiveKpsDisplayState,
  getSmoothedLiveKps,
  type LiveKpsSample,
} from './liveKpsDisplay'

describe('liveKpsDisplay', () => {
  it('shows unavailable (--) at 20s / 0.06 km with plausible pace', () => {
    const state = getLiveKpsDisplayState({
      isRunning: true,
      durationSeconds: 20,
      distanceKm: 0.06,
      paceSecPerKm: 333, // 5:33/km
      sampleCount: 5,
      smoothedRelativeKps: 96.4,
    })

    expect(state.text).toBe('--')
    expect(state.isCalibrating).toBe(true)
  })

  it('shows unavailable (--) at 63s / 0.14 km', () => {
    const state = getLiveKpsDisplayState({
      isRunning: true,
      durationSeconds: 63,
      distanceKm: 0.14,
      paceSecPerKm: 450, // 7:30/km
      sampleCount: 5,
      smoothedRelativeKps: 96.4,
    })

    expect(state.text).toBe('--')
    expect(state.isCalibrating).toBe(true)
  })

  it('shows unavailable (--) at 119s / 0.39 km with plausible pace', () => {
    const state = getLiveKpsDisplayState({
      isRunning: true,
      durationSeconds: 119,
      distanceKm: 0.39,
      paceSecPerKm: 305, // 5:05/km
      sampleCount: 5,
      smoothedRelativeKps: 96.4,
    })

    expect(state.text).toBe('--')
    expect(state.isCalibrating).toBe(true)
  })

  it('shows eligible at 120s / 0.39 km with valid rolling pace', () => {
    const state = getLiveKpsDisplayState({
      isRunning: true,
      durationSeconds: 120, // Meets time threshold
      distanceKm: 0.39,
      paceSecPerKm: 307,
      sampleCount: 5,
      smoothedRelativeKps: 96.4,
    })

    expect(state.text).toBe('96')
    expect(state.isCalibrating).toBe(false)
  })

  it('shows eligible at 60s / 0.40 km with valid rolling pace', () => {
    const state = getLiveKpsDisplayState({
      isRunning: true,
      durationSeconds: 60,
      distanceKm: 0.40, // Meets distance threshold
      paceSecPerKm: 150, // Too fast (below 180)
      sampleCount: 5,
      smoothedRelativeKps: 96.4,
    })

    expect(state.text).toBe('--')
    expect(state.isCalibrating).toBe(true)

    const validState = getLiveKpsDisplayState({
      isRunning: true,
      durationSeconds: 60,
      distanceKm: 0.40,
      paceSecPerKm: 185, // Valid
      sampleCount: 5,
      smoothedRelativeKps: 96.4,
    })

    expect(validState.text).toBe('96')
    expect(validState.isCalibrating).toBe(false)
  })

  it('returns unavailable for NaN / Infinity / too-fast / too-slow pace', () => {
    const baseOpts = {
      isRunning: true,
      durationSeconds: 150,
      distanceKm: 0.5,
      sampleCount: 5,
      smoothedRelativeKps: 96.4,
    }

    expect(getLiveKpsDisplayState({ ...baseOpts, paceSecPerKm: NaN }).isCalibrating).toBe(true)
    expect(getLiveKpsDisplayState({ ...baseOpts, paceSecPerKm: Infinity }).isCalibrating).toBe(true)
    expect(getLiveKpsDisplayState({ ...baseOpts, paceSecPerKm: 179 }).isCalibrating).toBe(true) // too fast
    expect(getLiveKpsDisplayState({ ...baseOpts, paceSecPerKm: 901 }).isCalibrating).toBe(true) // too slow
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
      durationSeconds: 130, // Past calibration
      distanceKm: 0.5,
      paceSecPerKm: 260,
      sampleCount: 5,
      smoothedRelativeKps: smoothed,
    })

    expect(state.text).toBe('90')
    expect(state.label).toBe('Live KPS')
    expect(state.numericValue).toBe(90)
    expect(state.isCalibrating).toBe(false)
  })

  it('caps live display at 100 (PB-relative; never show above lifetime cap)', () => {
    const state = getLiveKpsDisplayState({
      isRunning: true,
      durationSeconds: 130,
      distanceKm: 0.5,
      paceSecPerKm: 260,
      sampleCount: 5,
      smoothedRelativeKps: 108.2,
    })
    expect(state.text).toBe('100')
    expect(state.numericValue).toBe(100)
  })
})
