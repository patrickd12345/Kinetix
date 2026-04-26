import Foundation
import SwiftData

@MainActor
class MultiSignalCoachingEngine {
    static let shared = MultiSignalCoachingEngine()

    private init() {}

    struct SynthesisResult {
        let recommendation: String
        let intensityModifier: Double // 0.5 to 1.5
        let reasoning: String
        let showAlert: Bool
    }

    func synthesize(humanState: HumanState?, recentRuns: [Run], profile: RunnerProfile?) -> SynthesisResult {
        guard let state = humanState else {
            return SynthesisResult(
                recommendation: "Maintain your scheduled plan.",
                intensityModifier: 1.0,
                reasoning: "No recent recovery telemetry found. Proceeding with baseline plan.",
                showAlert: false
            )
        }

        var modifier = 1.0
        var reasons: [String] = []
        var showAlert = false

        // 1. Recovery Signal (Garmin)
        if state.bodyBattery < 40 {
            modifier *= 0.7
            reasons.append("Body Battery is critical (\(state.bodyBattery))")
            showAlert = true
        } else if state.bodyBattery > 85 {
            modifier *= 1.1
            reasons.append("Body Battery is primed (\(state.bodyBattery))")
        }

        if state.sleepScore < 60 {
            modifier *= 0.8
            reasons.append("Sleep quality was poor (\(state.sleepScore))")
            showAlert = true
        }

        // 2. Productivity Correlation (Cursor/GitHub)
        if state.productivityScore > 75 {
            modifier *= 0.9 // High cognitive load reduces physical capacity
            reasons.append("High cognitive load detected (Productivity Score: \(state.productivityScore))")
        }

        // 3. Synthesis
        let finalModifier = min(max(modifier, 0.5), 1.5)
        var recommendation = ""

        if finalModifier < 0.8 {
            recommendation = "Active Recovery / Rest"
        } else if finalModifier > 1.2 {
            recommendation = "High Intensity Session"
        } else {
            recommendation = "Standard Aerobic Base"
        }

        let reasoning = "Omni-Intelligence synthesized: \(reasons.joined(separator: ", ")). Final Intensity Modifier: \(String(format: "%.2f", finalModifier))."

        return SynthesisResult(
            recommendation: recommendation,
            intensityModifier: finalModifier,
            reasoning: reasoning,
            showAlert: showAlert
        )
    }

    func applyProactiveAdaptation(modelContext: ModelContext) async throws {
        let stateDescriptor = FetchDescriptor<HumanState>(sortBy: [SortDescriptor(\.date, order: .reverse)])
        let profileDescriptor = FetchDescriptor<RunnerProfile>()
        let runDescriptor = FetchDescriptor<Run>(sortBy: [SortDescriptor(\.date, order: .reverse)])

        let latestState = (try? modelContext.fetch(stateDescriptor))?.first
        let profile = (try? modelContext.fetch(profileDescriptor))?.first
        let recentRuns = (try? modelContext.fetch(runDescriptor))?.prefix(5).map { $0 } ?? []

        let synthesis = synthesize(humanState: latestState, recentRuns: recentRuns, profile: profile)

        // Log reasoning
        let log = ReasoningLog(
            category: "Training",
            decision: "Proactive Adaptation: \(synthesis.recommendation)",
            reasoningChain: synthesis.reasoning,
            inputs: [
                "modifier": "\(synthesis.intensityModifier)",
                "bb": "\(latestState?.bodyBattery ?? 0)",
                "sleep": "\(latestState?.sleepScore ?? 0)",
                "prod": "\(latestState?.productivityScore ?? 0)"
            ]
        )
        modelContext.insert(log)

        // Update local state for UI/Watch
        // This would typically involve modifying the 'Live Coach' ActivityTemplate
        try modelContext.save()
    }
}
