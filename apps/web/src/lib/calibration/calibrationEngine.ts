import { DISTANCE_FACTORS } from './distanceFactors'
import type { Distance, DistanceCalibration } from './types'

export function getCalibration(distance: Distance): DistanceCalibration {
  return DISTANCE_FACTORS[distance]
}
