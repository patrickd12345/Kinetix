export interface LiveKpsSample {
  atMs: number
  value: number
}

export interface LiveKpsDisplayState {
  text: string
  label: string
  numericValue: number | null
  isCalibrating: boolean
}

export const LIVE_KPS_CALIBRATION_SECONDS = 10
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

  if (options.durationSeconds < LIVE_KPS_CALIBRATION_SECONDS) {
    return {
      text: '--',
      label: 'Calibrating KPS',
      numericValue: null,
      isCalibrating: true,
    }
  }

  const numericValue =
    options.smoothedRelativeKps != null && Number.isFinite(options.smoothedRelativeKps) && options.smoothedRelativeKps > 0
      ? options.smoothedRelativeKps
      : null

  return {
    text: numericValue == null ? '--' : String(Math.round(numericValue)),
    label: numericValue == null ? 'Calibrating KPS' : 'Live KPS',
    numericValue,
    isCalibrating: numericValue == null,
  }
}
