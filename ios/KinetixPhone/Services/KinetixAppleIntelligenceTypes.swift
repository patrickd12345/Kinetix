import Foundation

enum KinetixAppleIntelligenceAvailability: String, Codable {
    case available
    case unavailable
}

struct ReadinessExplanationInput: Codable {
    let readinessScore: Int
    let readinessStatus: String
    let fatigueLevel: String
    let trendDirection: String
    let recommendationType: String
}

struct ReadinessExplanationResult: Codable {
    let text: String
    let usedFallback: Bool
}

struct PostRunSummaryInput: Codable {
    let distance: Double
    let duration: Double
    let pace: Double
    let kps: Double
    let heartRateAvg: Double?
    let trendDirection: String
}

struct PostRunSummaryResult: Codable {
    let text: String
    let usedFallback: Bool
}

struct PreRunSuggestionInput: Codable {
    let readinessScore: Int
    let fatigueLevel: String
    let recommendationType: String
}

struct PreRunSuggestionResult: Codable {
    let text: String
    let usedFallback: Bool
}

struct RecoveryAlertInput: Codable {
    let fatigueLevel: String
    let readinessScore: Int
}

struct RecoveryAlertResult: Codable {
    let text: String
    let usedFallback: Bool
}

// MARK: - Coach chat (KX-FEAT-008)

/// Final pass on strings shown in Coach chat UI — strips third-party setup leakage.
enum CoachChatSanitizer {
    static func sanitizeUserFacing(_ raw: String) -> String {
        let lower = raw.lowercased()
        if lower.contains("gemini")
            || lower.contains("google generative")
            || lower.contains("generativelanguage.googleapis.com")
            || lower.contains("api key")
            || lower.contains("add a key")
            || lower.contains("paste your key") {
            return SharedAIExecutionService.coachChatUnavailableUserMessage
        }
        return raw
    }
}
