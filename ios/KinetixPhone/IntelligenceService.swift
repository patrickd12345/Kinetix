import Foundation

/**
 * KX-FEAT-006: Recovery-Aware Coaching Foundation
 * Integration with Kinetix Backend for Recovery Data
 */
struct RecoveryStatusResponse: Codable {
    let recovery: GarminRecoveryData?
    let decision: CoachingDecision
}

struct GarminRecoveryData: Codable {
    let sleepScore: Int?
    let bodyBattery: Int?
    let stressLevel: Int?
    let hrv: Double?
    let restingHeartRate: Double?
    let vo2Max: Double?
    let timestamp: String
}

struct CoachingDecision: Codable {
    let recoveryState: String
    let guidance: String
    let decisionCode: String
    let visibleReason: String
}

class IntelligenceService: ObservableObject {
    @Published var latestRecovery: GarminRecoveryData?
    @Published var latestDecision: CoachingDecision?
    @Published var isFetching = false
    @Published var lastFetched: Date?

    static let shared = IntelligenceService()
    private init() {}

    @MainActor
    func fetchRecoveryStatus() async {
        isFetching = true
        defer { isFetching = false }

        // In a real app, this URL would be configured per environment
        // For POC, we use a placeholder that matches our backend route
        guard let url = URL(string: "https://kinetix.bookiji.com/api/coaching/recovery") else { return }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let response = try JSONDecoder().decode(RecoveryStatusResponse.self, from: data)

            self.latestRecovery = response.recovery
            self.latestDecision = response.decision
            self.lastFetched = Date()

            print("📱 IntelligenceService: Fetched recovery status. State: \(response.decision.recoveryState)")
        } catch {
            print("📱 IntelligenceService: Fetch failed: \(error.localizedDescription)")
            // Fallback to a default decision if fetch fails
            self.latestDecision = CoachingDecision(
                recoveryState: "optimal",
                guidance: "Your recovery looks good. Stick to your planned training.",
                decisionCode: "FETCH_FAILED_FALLBACK",
                visibleReason: "Using fallback due to fetch error."
            )
        }
    }
}
