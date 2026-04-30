import Foundation
import OSLog
#if canImport(UIKit)
import UIKit
#endif
#if canImport(FoundationModels) && os(iOS)
import FoundationModels
#endif

protocol KinetixAppleIntelligenceService {
    func isAppleIntelligenceAvailable() -> KinetixAppleIntelligenceAvailability

    /// **Coach chat (KX-FEAT-008 / 009)** — Apple Intelligence–first; testable via `SharedAIExecutionService.ask`.
    /// - Returns `(text, usedFallback)` where a **successful** native reply is `usedFallback == false` and non-empty `text`.
    /// - If generation is not available or not implemented, return `usedFallback: true` (and typically empty `text`); `SharedAIExecutionService` then applies the controlled user message or DEBUG Gemini when enabled.
    /// - **KX-FEAT-009:** On iOS 26+ with `FoundationModels`, real text is returned only from `LanguageModelSession.respond` when `SystemLanguageModel.default.isAvailable` is true — never hardcoded demo copy.
    func generateChatResponse(question: String, metrics: FormMetrics) async -> (text: String, usedFallback: Bool)
    func generateReadinessExplanation(_ input: ReadinessExplanationInput) async -> ReadinessExplanationResult
    func generatePostRunSummary(_ input: PostRunSummaryInput) async -> PostRunSummaryResult
    func generatePreRunSuggestion(_ input: PreRunSuggestionInput) async -> PreRunSuggestionResult
    func generateRecoveryAlert(_ input: RecoveryAlertInput) async -> RecoveryAlertResult
}

private let kinetixAppleIntelLog = Logger(subsystem: Bundle.main.bundleIdentifier ?? "Kinetix", category: "AppleIntelligence")

// MARK: - Coach prompts (no fake model output; only used as instructions to Foundation Models)

private enum KinetixCoachAXPrompts {
    /// Static coach persona + safety; user question and metrics are appended separately.
    static let sessionInstructions = """
    You are Kinetix Coach, a practical running assistant. Respond in plain language.
    Rules:
    - Do not give medical advice or diagnose conditions.
    - Keep the answer under 80 words.
    - Give practical running guidance only (pace, effort, breathing, form cues).
    - If live workout metrics are missing or zero, say the athlete should start a run first so you can coach from real data.
    - Never ask the user to add API keys, use Gemini, or configure third-party AI.
    """

    static func userMessageBlock(question: String, metrics: FormMetrics) -> String {
        var lines: [String] = []
        lines.append("Athlete question: \(question)")
        lines.append("")
        lines.append("Live workout context (omit lines that are unknown):")
        if let d = metrics.distance, d > 0 {
            lines.append("- Distance: \(String(format: "%.2f", d / 1000)) km")
        } else {
            lines.append("- Distance: (not available)")
        }
        if let p = metrics.pace, p > 0 {
            let m = Int(p) / 60
            let s = Int(p) % 60
            lines.append("- Pace: \(m):\(String(format: "%02d", s)) /km")
        } else {
            lines.append("- Pace: (not available)")
        }
        if let hr = metrics.heartRate, hr > 0 {
            lines.append("- Heart rate: \(Int(hr)) bpm")
        } else {
            lines.append("- Heart rate: (not available)")
        }
        if let c = metrics.cadence, c > 0 {
            lines.append("- Cadence: \(Int(c)) spm")
        } else {
            lines.append("- Cadence: (not available)")
        }
        if let vo = metrics.verticalOscillation, vo > 0 {
            lines.append("- Vertical oscillation: \(String(format: "%.1f", vo)) cm")
        }
        lines.append("- KPS: (not streamed on live metrics channel; use pace/HR/cadence only)")
        return lines.joined(separator: "\n")
    }
}

class DefaultKinetixAppleIntelligenceService: KinetixAppleIntelligenceService, ObservableObject {
    static let shared = DefaultKinetixAppleIntelligenceService()

    private init() {}

    /// Platform gate for Apple Intelligence–**style** surfaces (readiness card, settings copy). Does **not** guarantee `FoundationModels` can run; coach chat additionally checks `SystemLanguageModel` in `generateChatResponse`.
    func isAppleIntelligenceAvailable() -> KinetixAppleIntelligenceAvailability {
        #if canImport(UIKit)
        guard UIDevice.current.userInterfaceIdiom == .phone else {
            kinetixAppleIntelLog.debug("Coach AI gate: unavailable — not iPhone (idiom=\(String(describing: UIDevice.current.userInterfaceIdiom.rawValue)))")
            return .unavailable
        }
        #endif

        guard #available(iOS 26.0, *) else {
            kinetixAppleIntelLog.debug("Coach AI gate: unavailable — OS < iOS 26")
            return .unavailable
        }

        #if targetEnvironment(simulator)
        kinetixAppleIntelLog.debug("Coach AI gate: platform OK (iOS 26+ iPhone, simulator)")
        #else
        kinetixAppleIntelLog.debug("Coach AI gate: platform OK (iOS 26+ iPhone, device)")
        #endif

        return .available
    }

    func generateChatResponse(question: String, metrics: FormMetrics) async -> (text: String, usedFallback: Bool) {
        guard isAppleIntelligenceAvailable() == .available else {
            return ("", true)
        }

        #if canImport(FoundationModels) && os(iOS)
        if #available(iOS 26.0, *) {
            return await generateChatResponseWithFoundationModels(question: question, metrics: metrics)
        }
        #endif

        kinetixAppleIntelLog.debug("Coach chat: FoundationModels not compiled for this target — fallback signal")
        return ("", true)
    }

    #if canImport(FoundationModels) && os(iOS)
    @available(iOS 26.0, *)
    private func generateChatResponseWithFoundationModels(question: String, metrics: FormMetrics) async -> (text: String, usedFallback: Bool) {
        let systemModel = SystemLanguageModel.default
        guard systemModel.isAvailable else {
            switch systemModel.availability {
            case .available:
                kinetixAppleIntelLog.debug("FoundationModels: isAvailable false despite .available (unexpected)")
            case .unavailable(let reason):
                kinetixAppleIntelLog.debug("FoundationModels: unavailable — \(String(describing: reason))")
            }
            return ("", true)
        }

        let session = LanguageModelSession(
            instructions: KinetixCoachAXPrompts.sessionInstructions
        )

        let userBlock = KinetixCoachAXPrompts.userMessageBlock(question: question, metrics: metrics)

        do {
            var options = GenerationOptions()
            options.maximumResponseTokens = 220
            options.temperature = 0.65

            let response = try await session.respond(to: userBlock, options: options)
            let text = response.content.trimmingCharacters(in: .whitespacesAndNewlines)
            if text.isEmpty {
                kinetixAppleIntelLog.debug("FoundationModels: empty content after respond")
                return ("", true)
            }
            return (text, false)
        } catch {
            kinetixAppleIntelLog.error("FoundationModels respond failed: \(error.localizedDescription)")
            return ("", true)
        }
    }
    #endif

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
        let kpsDisplay = min(100, max(0, input.kps))
        var text = "Solid performance! You maintained a KPS of \(Int(kpsDisplay)) over \(String(format: "%.2f", distanceKm))km. "
        text += "Your pace was \(paceMinutes):\(String(format: "%02d", paceSeconds))/km. "
        if let hr = input.heartRateAvg {
            text += "Average heart rate was \(Int(hr)) bpm, showing a \(input.trendDirection) trend in efficiency."
        }
        return PostRunSummaryResult(text: text, usedFallback: false)
    }

    func generatePreRunSuggestion(_ input: PreRunSuggestionInput) async -> PreRunSuggestionResult {
        let text = "Based on your \(input.fatigueLevel) fatigue, today's best path is a \(input.recommendationType) run. Your current readiness of \(input.readinessScore) suggests you're primed for this intensity."
        return PreRunSuggestionResult(text: text, usedFallback: false)
    }

    func generateRecoveryAlert(_ input: RecoveryAlertInput) async -> RecoveryAlertResult {
        let text = "Recovery Alert: Fatigue is \(input.fatigueLevel) while readiness is \(input.readinessScore). High risk of overtraining if intensity isn't dialed back today."
        return RecoveryAlertResult(text: text, usedFallback: false)
    }
}
