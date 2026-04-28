import Foundation

protocol KinetixAppleIntelligenceService {
    func isAppleIntelligenceAvailable() -> KinetixAppleIntelligenceAvailability
    func generateReadinessExplanation(_ input: ReadinessExplanationInput) async -> ReadinessExplanationResult
    func generatePostRunSummary(_ input: PostRunSummaryInput) async -> PostRunSummaryResult
    func generatePreRunSuggestion(_ input: PreRunSuggestionInput) async -> PreRunSuggestionResult
    func generateRecoveryAlert(_ input: RecoveryAlertInput) async -> RecoveryAlertResult
}

class DefaultKinetixAppleIntelligenceService: KinetixAppleIntelligenceService, ObservableObject {
    static let shared = DefaultKinetixAppleIntelligenceService()

    private init() {}

    func isAppleIntelligenceAvailable() -> KinetixAppleIntelligenceAvailability {
        // Optimized for iPhone 17 Pro Max targeting
        guard #available(iOS 18.0, *) else {
            return .unavailable
        }
        // In a real iOS 18+ app, we would check for Apple Intelligence capability here
        return .available
    }

    func generateReadinessExplanation(_ input: ReadinessExplanationInput) async -> ReadinessExplanationResult {
        // Simulated on-device LLM generation for "Intelligence" feel
        try? await Task.sleep(nanoseconds: 1_500_000_000) // Simulate processing

        let text = "Your readiness is \(input.readinessStatus) at \(input.readinessScore). Fatigue is \(input.fatigueLevel), but your trend is \(input.trendDirection). I recommend a \(input.recommendationType) session to optimize your adaptation."
        return ReadinessExplanationResult(text: text, usedFallback: false)
    }

    func generatePostRunSummary(_ input: PostRunSummaryInput) async -> PostRunSummaryResult {
        try? await Task.sleep(nanoseconds: 1_200_000_000)

        let distanceKm = input.distance / 1000
        let paceMinutes = Int(input.pace / 60)
        let paceSeconds = Int(input.pace.truncatingRemainder(dividingBy: 60))
        var text = "Solid performance! You maintained a KPS of \(Int(input.kps)) over \(String(format: "%.2f", distanceKm))km. "
        text += "Your pace was \(paceMinutes):\(String(format: "%02d", paceSeconds))/km. "
        if let hr = input.heartRateAvg {
            text += "Average heart rate was \(Int(hr)) bpm, showing a \(input.trendDirection) trend in efficiency."
        }
        return PostRunSummaryResult(text: text, usedFallback: false)
    }

    func generatePreRunSuggestion(_ input: PreRunSuggestionInput) async -> PreRunSuggestionResult {
<<<<<<< HEAD
        if let recovery = input.recoveryState, recovery == "reduced_intensity_recommended" {
             return PreRunSuggestionResult(
                text: "Recovery is low today. Prefer easy effort or rest. Suggestion: \(input.recommendationType) at reduced intensity.",
                usedFallback: true
            )
        }

        guard isAppleIntelligenceAvailable() == .available else {
            return PreRunSuggestionResult(
                text: "You're moderately ready today.",
                usedFallback: true
            )
        }

        let text = "Readiness \(input.readinessScore) with \(input.fatigueLevel) fatigue. Recommended session: \(input.recommendationType)."
=======
        let text = "Based on your \(input.fatigueLevel) fatigue, today's best path is a \(input.recommendationType) run. Your current readiness of \(input.readinessScore) suggests you're primed for this intensity."
>>>>>>> origin/main
        return PreRunSuggestionResult(text: text, usedFallback: false)
    }

    func generateRecoveryAlert(_ input: RecoveryAlertInput) async -> RecoveryAlertResult {
        let text = "Recovery Alert: Fatigue is \(input.fatigueLevel) while readiness is \(input.readinessScore). High risk of overtraining if intensity isn't dialed back today."
        return RecoveryAlertResult(text: text, usedFallback: false)
    }
}
