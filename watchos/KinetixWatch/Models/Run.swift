import Foundation
import SwiftData

@Model
final class Run {
    var id: UUID
    var date: Date
    var distance: Double // in meters
    var duration: TimeInterval // in seconds
    var avgPace: Double // seconds per km
    var avgNPI: Double
    var avgHeartRate: Double
    
    init(date: Date = Date(), distance: Double, duration: TimeInterval, avgPace: Double, avgNPI: Double, avgHeartRate: Double) {
        self.id = UUID()
        self.date = date
        self.distance = distance
        self.duration = duration
        self.avgPace = avgPace
        self.avgNPI = avgNPI
        self.avgHeartRate = avgHeartRate
    }
}

