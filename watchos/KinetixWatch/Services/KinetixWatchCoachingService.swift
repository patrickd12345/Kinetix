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

protocol KinetixAppleIntelligenceService {
    func isAppleIntelligenceAvailable() -> KinetixAppleIntelligenceAvailability
    func generateReadinessExplanation(_ input: ReadinessExplanationInput) async -> ReadinessExplanationResult
    func generatePostRunSummary(_ input: PostRunSummaryInput) async -> PostRunSummaryResult
    func generatePreRunSuggestion(_ input: PreRunSuggestionInput) async -> PreRunSuggestionResult
    func generateRecoveryAlert(_ input: RecoveryAlertInput) async -> RecoveryAlertResult
}

struct KinetixWatchCoachingService: KinetixAppleIntelligenceService {
    func isAppleIntelligenceAvailable() -> KinetixAppleIntelligenceAvailability {
        guard #available(watchOS 11.0, *) else { return .unavailable }
        let hasEligibleHardware = false // Placeholder until a production capability check is finalized.
        return hasEligibleHardware ? .available : .unavailable
    }

    func generateReadinessExplanation(_ input: ReadinessExplanationInput) async -> ReadinessExplanationResult {
        guard isAppleIntelligenceAvailable() == .available else {
            return ReadinessExplanationResult(text: "Your readiness is moderate. Consider an easy run.", usedFallback: true)
        }
        return ReadinessExplanationResult(
            text: "Readiness \(input.readinessScore), \(input.readinessStatus), fatigue \(input.fatigueLevel), trend \(input.trendDirection), suggestion \(input.recommendationType).",
            usedFallback: false
        )
    }

    func generatePostRunSummary(_ input: PostRunSummaryInput) async -> PostRunSummaryResult {
        guard isAppleIntelligenceAvailable() == .available else {
            return PostRunSummaryResult(text: "Good run. You're maintaining consistency.", usedFallback: true)
        }
        return PostRunSummaryResult(
            text: "Distance \(String(format: "%.2f", input.distance / 1000)) km, pace \(String(format: "%.0f", input.pace)) sec/km, KPS \(Int(input.kps)), trend \(input.trendDirection).",
            usedFallback: false
        )
    }

    func generatePreRunSuggestion(_ input: PreRunSuggestionInput) async -> PreRunSuggestionResult {
        guard isAppleIntelligenceAvailable() == .available else {
            return PreRunSuggestionResult(text: "You're moderately ready today.", usedFallback: true)
        }
        return PreRunSuggestionResult(
            text: "You are at readiness \(input.readinessScore) with \(input.fatigueLevel) fatigue. Session: \(input.recommendationType).",
            usedFallback: false
        )
    }

    func generateRecoveryAlert(_ input: RecoveryAlertInput) async -> RecoveryAlertResult {
        guard isAppleIntelligenceAvailable() == .available else {
            return RecoveryAlertResult(text: "Fatigue is elevated. Consider recovery.", usedFallback: true)
        }
        return RecoveryAlertResult(
            text: "Recovery alert: fatigue \(input.fatigueLevel), readiness \(input.readinessScore).",
            usedFallback: false
        )
    }
}
