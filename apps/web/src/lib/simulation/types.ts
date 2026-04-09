export interface RaceSimulationInput {
  distance: '5k' | '10k' | 'half' | 'marathon'
  projectedSeconds: number
  fatigueLevel: 'low' | 'moderate' | 'high'
  trend: number
  confidence: number
}

export interface RaceSplit {
  segmentStart: number
  segmentEnd: number
  paceSecondsPerKm: number
}

export interface RaceSimulationResult {
  projectedFinishSeconds: number
  splits: RaceSplit[]
  fadeRisk: 'low' | 'moderate' | 'high'
  pacingRecommendation: string
}
