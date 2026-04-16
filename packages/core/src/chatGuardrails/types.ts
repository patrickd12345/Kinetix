export type ProvenanceKind =
  | 'verified_math'
  | 'verified_fact'
  | 'user_input'
  | 'retrieved_context'
  | 'model_inference'

export interface Provenance {
  kind: ProvenanceKind
  source: string
  path?: string
}

export type AllowedOutputMode =
  | 'explanation'
  | 'comparison'
  | 'coaching_summary'
  | 'motivation'
  | 'insufficient_data'
  | 'verified_math'

export type ForbiddenOperation =
  | 'invent_numbers'
  | 'introduce_new_numeric_value'
  | 'derive_new_numeric_target'
  | 'modify_verified_values'
  | 'infer_missing_inputs'
  | 'medical_diagnosis'
  | 'unsupported_prediction'
  | 'future_performance_prediction'
  | 'physiological_claim'
  | 'injury_prediction'
  | 'training_effect_prediction'
  | 'performance_ranking_claim'
  | 'trend_claim'
  | 'improvement_claim'
  | 'regression_claim'

export type GuardrailTemplateKind =
  | 'verified_math'
  | 'fail_closed_math'
  | 'verified_run_analysis'
  | 'comparison'
  | 'insufficient_data'
  | 'general_coach_safe'

export type AdviceConfidence = 'deterministic' | 'supported' | 'heuristic' | 'blocked'

export interface VerifiedFactContract {
  verifiedFacts: Record<string, unknown>
  userStatedFacts: Record<string, unknown>
  allowedOutputModes: AllowedOutputMode[]
  forbiddenOperations: ForbiddenOperation[]
  provenance: Provenance[]
}

export interface CoachGuardrailPayload {
  mode: 'coach'
  contract: VerifiedFactContract
  templateHint?: GuardrailTemplateKind | 'auto'
}
