import Foundation
import SwiftData

@Model
final class RunnerProfile {
    var id: UUID
    var weightKg: Double
    var dateOfBirth: Date
    var sex: String
    var targetKps: Double
    
    init(id: UUID = UUID(), weightKg: Double = 70, dateOfBirth: Date = Calendar.current.date(byAdding: .year, value: -30, to: Date()) ?? Date(), sex: String = "unspecified", targetKps: Double = 95.0) {
        self.id = id
        self.weightKg = weightKg
        self.dateOfBirth = dateOfBirth
        self.sex = sex
        self.targetKps = targetKps
    }
}

@Model
final class DiagnosticLogEntry {
    var id: UUID
    var timestamp: Date
    var category: String
    var message: String
    
    init(id: UUID = UUID(), timestamp: Date = Date(), category: String = "general", message: String) {
        self.id = id
        self.timestamp = timestamp
        self.category = category
        self.message = message
    }
}
