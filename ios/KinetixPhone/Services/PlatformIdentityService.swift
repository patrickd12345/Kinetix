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

    func checkLoyaltyStatus(runs: [Run], states: [HumanState]) -> LoyaltyStatus {
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

        return LoyaltyStatus(points: points, level: level, nextMilestone: next)
    }

    func syncToPlatform(modelContext: ModelContext) async {
        // Placeholder for syncing Omni-Intelligence state to Bookiji Platform (Supabase)
        // This ensures the "Human-State" is consistent across the product family
        print("Syncing Human-State to platform.profiles...")
    }
}
