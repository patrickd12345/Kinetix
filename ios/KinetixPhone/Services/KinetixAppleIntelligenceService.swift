import Foundation

protocol KinetixAppleIntelligenceService {
    func isAppleIntelligenceAvailable() -> KinetixAppleIntelligenceAvailability
    func generateReadinessExplanation(_ input: ReadinessExplanationInput) async -> ReadinessExplanationResult
    func generatePostRunSummary(_ input: PostRunSummaryInput) async -> PostRunSummaryResult
    func generatePreRunSuggestion(_ input: PreRunSuggestionInput) async -> PreRunSuggestionResult
    func generateRecoveryAlert(_ input: RecoveryAlertInput) async -> RecoveryAlertResult
}

struct DefaultKinetixAppleIntelligenceService: KinetixAppleIntelligenceService {
    func isAppleIntelligenceAvailable() -> KinetixAppleIntelligenceAvailability {
        guard #available(iOS 18.0, watchOS 11.0, *) else {
            return .unavailable
        }
        let hasEligibleHardware = false // Placeholder until final capability API is defined.
        return hasEligibleHardware ? .available : .unavailable
    }

    func generateReadinessExplanation(_ input: ReadinessExplanationInput) async -> ReadinessExplanationResult {
        guard isAppleIntelligenceAvailable() == .available else {
            return ReadinessExplanationResult(
                text: "Your readiness is moderate. Consider an easy run.",
                usedFallback: true
            )
        }

        let text = "Readiness \(input.readinessScore) (\(input.readinessStatus)) with \(input.fatigueLevel) fatigue and a \(input.trendDirection) trend. Suggested focus: \(input.recommendationType)."
        return ReadinessExplanationResult(text: text, usedFallback: false)
    }

    func generatePostRunSummary(_ input: PostRunSummaryInput) async -> PostRunSummaryResult {
        guard isAppleIntelligenceAvailable() == .available else {
            return PostRunSummaryResult(
                text: "Good run. You're maintaining consistency.",
                usedFallback: true
            )
        }

        let distanceKm = input.distance / 1000
        let paceMinutes = Int(input.pace / 60)
        let paceSeconds = Int(input.pace.truncatingRemainder(dividingBy: 60))
        var text = "You covered \(String(format: "%.2f", distanceKm)) km at \(paceMinutes):\(String(format: "%02d", paceSeconds))/km with KPS \(Int(input.kps))."
        if let hr = input.heartRateAvg {
            text += " Average heart rate was \(Int(hr)) bpm."
        }
        text += " Trend is \(input.trendDirection)."
        return PostRunSummaryResult(text: text, usedFallback: false)
    }

    func generatePreRunSuggestion(_ input: PreRunSuggestionInput) async -> PreRunSuggestionResult {
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
        return PreRunSuggestionResult(text: text, usedFallback: false)
    }

    func generateRecoveryAlert(_ input: RecoveryAlertInput) async -> RecoveryAlertResult {
        guard isAppleIntelligenceAvailable() == .available else {
            return RecoveryAlertResult(
                text: "Fatigue is elevated. Consider recovery.",
                usedFallback: true
            )
        }

        let text = "Recovery check: fatigue is \(input.fatigueLevel) with readiness \(input.readinessScore). Keep intensity controlled."
        return RecoveryAlertResult(text: text, usedFallback: false)
    }
}
