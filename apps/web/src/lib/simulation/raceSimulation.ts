import { getCalibration } from '../calibration/calibrationEngine'
import type { Distance } from '../calibration/types'
import { computeFadeRisk, fatigueMultiplierAt } from './fatigueCurve'
import { pacingOffsets, pacingRecommendation } from './pacingStrategy'
import type { RaceSimulationInput, RaceSimulationResult, RaceSplit } from './types'

const DISTANCE_KM: Record<Distance, number> = {
  '5k': 5,
  '10k': 10,
  half: 21.0975,
  marathon: 42.195,
}

const SEGMENTS_BY_DISTANCE: Record<Distance, number> = {
  '5k': 5,
  '10k': 5,
  half: 6,
  marathon: 8,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function buildSegments(distance: Distance): Array<{ start: number; end: number }> {
  const totalKm = DISTANCE_KM[distance]
  const segmentCount = SEGMENTS_BY_DISTANCE[distance]
  const segmentLength = totalKm / segmentCount
  const segments: Array<{ start: number; end: number }> = []

  for (let i = 0; i < segmentCount; i += 1) {
    const start = i * segmentLength
    const end = i === segmentCount - 1 ? totalKm : (i + 1) * segmentLength
    segments.push({ start, end })
  }

  return segments
}

export function computeRaceSimulation(input: RaceSimulationInput): RaceSimulationResult {
  const distanceKm = DISTANCE_KM[input.distance]
  const baselinePace = input.projectedSeconds / distanceKm
  const calibration = getCalibration(input.distance)
  const fadeRisk = computeFadeRisk(
    input.distance,
    input.fatigueLevel,
    input.trend,
    input.confidence,
    calibration.fatiguePenalty
  )

  const segments = buildSegments(input.distance)
  const offsets = pacingOffsets(segments.length, fadeRisk, input.trend)
  const splits: RaceSplit[] = []

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]
    const midpointProgress = (segment.start + segment.end) / 2 / distanceKm
    const fatigueMultiplier = fatigueMultiplierAt(
      input.distance,
      input.fatigueLevel,
      midpointProgress,
      calibration.fatiguePenalty
    )
    const strategicMultiplier = 1 + offsets[i]
    const pace = baselinePace * strategicMultiplier * fatigueMultiplier
    const clampedPace = clamp(pace, 120, 600)

    splits.push({
      segmentStart: Number(segment.start.toFixed(3)),
      segmentEnd: Number(segment.end.toFixed(3)),
      paceSecondsPerKm: clampedPace,
    })
  }

  const projectedFinishSeconds = Math.round(
    splits.reduce((sum, split) => {
      const segmentDistance = split.segmentEnd - split.segmentStart
      return sum + split.paceSecondsPerKm * segmentDistance
    }, 0)
  )

  const boundedFinishSeconds = Math.round(
    clamp(projectedFinishSeconds, input.projectedSeconds * 0.85, input.projectedSeconds * 1.25)
  )

  return {
    projectedFinishSeconds: boundedFinishSeconds,
    splits,
    fadeRisk,
    pacingRecommendation: pacingRecommendation(fadeRisk, input.trend),
  }
}
