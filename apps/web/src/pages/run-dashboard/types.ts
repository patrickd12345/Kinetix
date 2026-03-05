export type BeatTargetOption =
  | { type: 'distance'; label: string; distanceKm: number; timeSeconds: number }
  | { type: 'time'; label: string; timeSeconds: number; distanceKm: number }

