import Foundation
import SwiftData

@Model
final class HumanState {
    @Attribute(.unique) var id: String
    var date: Date

    // Garmin Recovery Data
    var bodyBattery: Int
    var stressLevel: Int
    var sleepScore: Int
    var restingHeartRate: Int

    // Productivity Context (Cursor/GitHub activity correlation)
    var productivityScore: Int // 0-100
    var deepWorkMinutes: Int

    // Derived Physical State
    var physicalReadiness: Double // 0.0 to 1.0

    init(
        id: String = UUID().uuidString,
        date: Date = .now,
        bodyBattery: Int = 0,
        stressLevel: Int = 0,
        sleepScore: Int = 0,
        restingHeartRate: Int = 0,
        productivityScore: Int = 0,
        deepWorkMinutes: Int = 0
    ) {
        self.id = id
        self.date = date
        self.bodyBattery = bodyBattery
        self.stressLevel = stressLevel
        self.sleepScore = sleepScore
        self.restingHeartRate = restingHeartRate
        self.productivityScore = productivityScore
        self.deepWorkMinutes = deepWorkMinutes

        // Initial heuristic for readiness
        let recoveryFactor = (Double(bodyBattery) + Double(sleepScore)) / 200.0
        let stressFactor = 1.0 - (Double(stressLevel) / 100.0)
        self.physicalReadiness = (recoveryFactor + stressFactor) / 2.0
    }
}

@Model
final class ReasoningLog {
    @Attribute(.unique) var id: String
    var timestamp: Date
    var category: String // "Recovery", "Training", "Productivity"
    var decision: String
    var reasoningChain: String
    var inputs: [String: String]

    init(
        id: String = UUID().uuidString,
        timestamp: Date = .now,
        category: String,
        decision: String,
        reasoningChain: String,
        inputs: [String: String] = [:]
    ) {
        self.id = id
        self.timestamp = timestamp
        self.category = category
        self.decision = decision
        self.reasoningChain = reasoningChain
        self.inputs = inputs
    }
}
