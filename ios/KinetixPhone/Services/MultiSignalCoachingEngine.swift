import Foundation
import SwiftData
import UserNotifications

@MainActor
class MultiSignalCoachingEngine {
    static let shared = MultiSignalCoachingEngine()

    private init() {}

    struct SynthesisResult {
        let recommendation: String
        let intensityModifier: Double // 0.5 to 1.5
        let reasoning: String
        let showAlert: Bool
        let sessionType: ActivityGoalType
    }

    func synthesize(humanState: HumanState?, recentRuns: [Run], profile: RunnerProfile?) -> SynthesisResult {
        guard let state = humanState else {
            return SynthesisResult(
                recommendation: "Maintain your scheduled plan.",
                intensityModifier: 1.0,
                reasoning: "No recent recovery telemetry found. Proceeding with baseline plan.",
                showAlert: false,
                sessionType: .efficiency
            )
        }

        var modifier = 1.0
        var reasons: [String] = []
        var showAlert = false
        var goal: ActivityGoalType = .efficiency

        // 1. Recovery Signal (Garmin)
        if state.bodyBattery < 40 {
            modifier *= 0.6
            reasons.append("Body Battery is critical (\(state.bodyBattery))")
            showAlert = true
            goal = .freeRun // Downgrade to Free Run / Recovery
        } else if state.bodyBattery > 85 {
            modifier *= 1.1
            reasons.append("Body Battery is primed (\(state.bodyBattery))")
            goal = .race // Upgrade to Performance focus
        }

        if state.sleepScore < 60 {
            modifier *= 0.7
            reasons.append("Sleep quality was poor (\(state.sleepScore))")
            showAlert = true
            if goal != .freeRun { goal = .formMonitor } // Downgrade focus
        }

        // 2. Productivity Correlation (Cursor/GitHub)
        // directive: correlate "Deep Work" sessions with stress spikes.
        if state.deepWorkMinutes > 180 && state.stressLevel > 40 {
            modifier *= 0.85
            reasons.append("High cognitive load + physiological stress detected (\(state.deepWorkMinutes)m Deep Work)")
            if goal == .race { goal = .efficiency }
        }

        // 3. Synthesis
        let finalModifier = min(max(modifier, 0.4), 1.5)
        var recommendation = ""

        if finalModifier < 0.75 {
            recommendation = "Active Recovery / Rest"
            goal = .freeRun
        } else if finalModifier > 1.25 {
            recommendation = "High Intensity Session"
            goal = .race
        } else {
            recommendation = "Standard Aerobic Base"
            goal = .efficiency
        }

        let reasoning = "Omni-Intelligence synthesized: \(reasons.joined(separator: ", ")). Final Intensity Modifier: \(String(format: "%.2f", finalModifier)). Mode assigned: \(goal.displayName)."

        return SynthesisResult(
            recommendation: recommendation,
            intensityModifier: finalModifier,
            reasoning: reasoning,
            showAlert: showAlert,
            sessionType: goal
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

        // 1. Log reasoning for transparency (Directive Requirement)
        let log = ReasoningLog(
            category: "Training",
            decision: "Proactive Adaptation: \(synthesis.recommendation)",
            reasoningChain: synthesis.reasoning,
            inputs: [
                "modifier": "\(synthesis.intensityModifier)",
                "bb": "\(latestState?.bodyBattery ?? 0)",
                "sleep": "\(latestState?.sleepScore ?? 0)",
                "deep_work": "\(latestState?.deepWorkMinutes ?? 0)",
                "stress": "\(latestState?.stressLevel ?? 0)"
            ]
        )
        modelContext.insert(log)

        // 2. Auto-modify the daily 'Live Coach' activity template (Directive Requirement)
        try await modifyLiveCoachTemplate(goal: synthesis.sessionType, modelContext: modelContext)

        // 3. Push "Reduced Intensity" notification if needed (Directive Requirement)
        if synthesis.showAlert {
            sendIntensityNotification(reason: synthesis.recommendation)
        }

        try modelContext.save()
    }

    private func modifyLiveCoachTemplate(goal: ActivityGoalType, modelContext: ModelContext) async throws {
        let descriptor = FetchDescriptor<ActivityTemplate>()
        let templates = try modelContext.fetch(descriptor)

        if let liveCoach = templates.first(where: { $0.name == "Live Coach" }) {
            liveCoach.goal = goal
            liveCoach.lastModified = .now
            print("📱 Auto-modified 'Live Coach' template to \(goal.rawValue)")

            // Trigger sync to watch
            ConnectivityManager.shared.syncActivitiesFromBuilder(templates)
        }
    }

    private func sendIntensityNotification(reason: String) {
        let content = UNMutableNotificationContent()
        content.title = "Kinetix Recovery Alert"
        content.body = "Omni-Intelligence recommends: \(reason). Intensity modifier applied to your next run."
        content.sound = .default

        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}
