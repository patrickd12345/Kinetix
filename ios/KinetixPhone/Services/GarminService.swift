import Foundation
import SwiftData

@MainActor
class GarminService: ObservableObject {
    static let shared = GarminService()

    @Published var isConnected: Bool = false
    @Published var lastSyncAt: Date?
    @Published var needsReauth: Bool = false

    private init() {
        // Check local keychain for Garmin tokens
        checkTokenStatus()
    }

    func checkTokenStatus() {
        // Placeholder for keychain check
        self.isConnected = false
    }

    func connect() async throws {
        // Simulated OAuth handshake for Garmin Connect
        try await Task.sleep(nanoseconds: 1_000_000_000)
        self.isConnected = true
        self.lastSyncAt = Date()
    }

    func fetchLatestHumanState(modelContext: ModelContext) async throws {
        guard isConnected else { throw NSError(domain: "Garmin", code: 401, userInfo: [NSLocalizedDescriptionKey: "Garmin not connected"]) }

        // Simulated Garmin API fetch (Body Battery, Stress, Sleep)
        // Correlated with simulated Productivity context

        let newState = HumanState(
            bodyBattery: Int.random(in: 30...95),
            stressLevel: Int.random(in: 10...60),
            sleepScore: Int.random(in: 50...90),
            restingHeartRate: Int.random(in: 48...65),
            productivityScore: Int.random(in: 20...80),
            deepWorkMinutes: Int.random(in: 60...300)
        )

        modelContext.insert(newState)
        try modelContext.save()

        lastSyncAt = Date()

        // Log the ingestion
        let log = ReasoningLog(
            category: "Recovery",
            decision: "Ingest Human-State",
            reasoningChain: "Omni-Intelligence ingested Garmin recovery telemetry. Body Battery: \(newState.bodyBattery), Stress: \(newState.stressLevel). Correlating with Productivity Score \(newState.productivityScore) from Cursor/GitHub logs.",
            inputs: ["bb": "\(newState.bodyBattery)", "stress": "\(newState.stressLevel)", "prod": "\(newState.productivityScore)"]
        )
        modelContext.insert(log)
    }
}
