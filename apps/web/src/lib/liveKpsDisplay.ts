export interface LiveKpsSample {
  atMs: number
  value: number
}

import { capDisplayRelativeKps } from './kpsDisplayPolicy'

export interface LiveKpsDisplayState {
  text: string
  label: string
  numericValue: number | null
  isCalibrating: boolean
}

export const LIVE_KPS_MIN_DURATION_SECONDS = 120
export const LIVE_KPS_MIN_DISTANCE_KM = 0.40
export const LIVE_KPS_MIN_PACE = 180
export const LIVE_KPS_MAX_PACE = 900
export const LIVE_KPS_SMOOTHING_WINDOW_MS = 3000

export function appendLiveKpsSample(samples: LiveKpsSample[], sample: LiveKpsSample): LiveKpsSample[] {
  if (!Number.isFinite(sample.value) || sample.value <= 0) {
    return samples.filter((entry) => sample.atMs - entry.atMs <= LIVE_KPS_SMOOTHING_WINDOW_MS)
  }

  return [...samples, sample].filter((entry) => sample.atMs - entry.atMs <= LIVE_KPS_SMOOTHING_WINDOW_MS)
}

export function getSmoothedLiveKps(samples: LiveKpsSample[]): number | null {
  if (samples.length === 0) return null

  const sum = samples.reduce((total, sample) => total + sample.value, 0)
  return sum / samples.length
}

export function getLiveKpsDisplayState(options: {
  isRunning: boolean
  durationSeconds: number
  distanceKm: number
  paceSecPerKm: number
  sampleCount?: number
  smoothedRelativeKps: number | null
}): LiveKpsDisplayState {
  if (!options.isRunning) {
    return {
      text: '0',
      label: 'Live KPS',
      numericValue: 0,
      isCalibrating: false,
    }
  }

  const hasEnoughTimeOrDistance = options.durationSeconds >= LIVE_KPS_MIN_DURATION_SECONDS || options.distanceKm >= LIVE_KPS_MIN_DISTANCE_KM
  const hasValidDistance = options.distanceKm > 0
  const hasValidPace = Number.isFinite(options.paceSecPerKm) && options.paceSecPerKm >= LIVE_KPS_MIN_PACE && options.paceSecPerKm <= LIVE_KPS_MAX_PACE
  const hasEnoughSamples = options.sampleCount === undefined || options.sampleCount >= 2

  if (!hasEnoughTimeOrDistance || !hasValidDistance || !hasValidPace || !hasEnoughSamples) {
    return {
      text: '--',
      label: 'Calibrating KPS',
      numericValue: null,
      isCalibrating: true,
    }
  }

  const numericValue =
    options.smoothedRelativeKps != null && Number.isFinite(options.smoothedRelativeKps) && options.smoothedRelativeKps > 0
      ? capDisplayRelativeKps(options.smoothedRelativeKps)
      : null

  return {
    text: numericValue == null ? '--' : String(Math.round(numericValue)),
    label: numericValue == null ? 'Calibrating KPS' : 'Live KPS',
    numericValue,
    isCalibrating: numericValue == null,
  }
}
