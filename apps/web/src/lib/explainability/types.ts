export interface CoachEvidenceItem {
  key:
    | 'load_risk'
    | 'fatigue'
    | 'phase'
    | 'prediction'
    | 'goal_urgency'
    | 'confidence'
  label: string
  value: string
  impact: 'primary' | 'secondary'
}

export interface CoachExplanationResult {
  decision: string
  summary: string
  evidence: CoachEvidenceItem[]
  confidence: 'low' | 'medium' | 'high'
}
