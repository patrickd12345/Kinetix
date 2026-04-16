import type { UserProfile } from '../kps/calculator'

export type VerifiedMathOperation =
  | 'average_pace_segments'
  | 'pace_from_time_distance'
  | 'time_from_pace_distance'
  | 'convert_pace_mi_km'
  | 'convert_pace_km_mi'
  | 'kps_from_distance_time'
  | 'percent_delta'
  | 'unknown'

/**
 * Structured calculator output for chat. The LLM must not alter numeric fields.
 */
export interface VerifiedMathResult {
  type: 'verified_math_result'
  operation: VerifiedMathOperation
  canAnswer: boolean
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  formatted: Record<string, string>
  error?: string
  missingInputs?: string[]
}

export interface ChatMathContext {
  userProfile?: UserProfile | null
  /** Preferred display for pace strings */
  unitSystem?: 'metric' | 'imperial'
}

export { type UserProfile }
