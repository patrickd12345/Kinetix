import Foundation

#if os(watchOS)
/// Watch companion build; coach chat UI primarily targets iPhone. Stub keeps `AICoach` / shared types compiling.
final class DefaultKinetixAppleIntelligenceService {
    static let shared = DefaultKinetixAppleIntelligenceService()

    func generateChatResponse(question: String, metrics: FormMetrics) async -> (text: String, usedFallback: Bool) {
        _ = question
        _ = metrics
        // Empty + fallback so `SharedAIExecutionService.ask` returns the controlled user message (same contract as iPhone unavailable path).
        return ("", true)
    }
}
#endif
