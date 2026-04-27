import Foundation

enum KinetixAppleIntelligenceAvailability {
    case available
    case unavailable
}

struct ReadinessExplanationInput {
    let readinessScore: Int
    let readinessStatus: String
    let fatigueLevel: String
    let trendDirection: String
    let recommendationType: String
}

struct ReadinessExplanationResult {
    let text: String
    let usedFallback: Bool
}

struct PostRunSummaryInput {
    let distance: Double
    let pace: Double
    let heartRateAvg: Double?
    let kps: Double
    let trendDirection: String
}

struct PostRunSummaryResult {
    let text: String
    let usedFallback: Bool
}

struct PreRunSuggestionInput {
    let readinessScore: Int
    let fatigueLevel: String
    let recommendationType: String
    let recoveryState: String? // Added for KX-FEAT-006
}

struct PreRunSuggestionResult {
    let text: String
    let usedFallback: Bool
}

struct RecoveryAlertInput {
    let fatigueLevel: String
    let readinessScore: Int
}

struct RecoveryAlertResult {
    let text: String
    let usedFallback: Bool
}
