export type Distance =
  | '5k'
  | '10k'
  | 'half'
  | 'marathon'

export interface DistanceCalibration {
  speedWeight: number
  enduranceWeight: number
  fatiguePenalty: number
  trendSensitivity: number
}
