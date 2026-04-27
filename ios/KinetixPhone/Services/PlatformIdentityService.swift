import Foundation
import SwiftData

@MainActor
class PlatformIdentityService {
    static let shared = PlatformIdentityService()

    private init() {}

    struct LoyaltyStatus {
        let points: Int
        let level: String
        let nextMilestone: String
    }

    func checkLoyaltyStatus(runs: [Run], states: [HumanState], modelContext: ModelContext? = nil) -> LoyaltyStatus {
        // Multi-signal loyalty: physical performance + recovery discipline
        let totalKm = runs.map { $0.distance }.reduce(0, +) / 1000.0
        let disciplinedDays = states.filter { $0.sleepScore > 75 && $0.bodyBattery > 60 }.count

        let points = Int(totalKm * 10) + (disciplinedDays * 50)

        var level = "Bronze"
        var next = "Silver (1000 pts)"

        if points > 5000 {
            level = "Platinum"
            next = "Max Level"
        } else if points > 2500 {
            level = "Gold"
            next = "Platinum (5000 pts)"
        } else if points > 1000 {
            level = "Silver"
            next = "Gold (2500 pts)"
        }

        // Log milestone if context provided and threshold reached
        if let context = modelContext, points >= 1000 {
            checkAndLogMilestones(points: points, modelContext: context)
        }

        return LoyaltyStatus(points: points, level: level, nextMilestone: next)
    }

    private func checkAndLogMilestones(points: Int, modelContext: ModelContext) {
        // Simple logic to prevent duplicate logs would go here in a production app
        if points >= 1000 && points < 1100 {
            let log = ReasoningLog(
                category: "Loyalty",
                decision: "Silver Milestone Reached",
                reasoningChain: "User has accumulated 1000+ loyalty points through consistent tracking and high recovery discipline. Bookiji Platform loyalty loop triggered.",
                inputs: ["total_points": "\(points)"]
            )
            modelContext.insert(log)
        }
    }

    func syncToPlatform(modelContext: ModelContext) async {
        guard let token = await AuthService.shared.currentAccessToken(), !token.isEmpty else {
            return
        }

        let url = KinetixEnvironment.webBaseURL.appendingPathComponent("api/platform-profile/sync")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data("{}".utf8)

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            if code != 200 {
                print("PlatformIdentityService: Lane A handler missing or error (HTTP \(code)); needs server proxy from Lane A")
            }
        } catch {
            print("PlatformIdentityService: sync failed — \(error.localizedDescription); needs server proxy from Lane A")
        }
    }
}
