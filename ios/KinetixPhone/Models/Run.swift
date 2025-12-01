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
    var avgCadence: Double?
    var avgVerticalOscillation: Double?
    var avgGroundContactTime: Double?
    var avgStrideLength: Double?
    var formScore: Double?
    var routeData: [RoutePoint] = []
    var formSessionId: UUID?
    
    init(
        date: Date = Date(),
        distance: Double,
        duration: TimeInterval,
        avgPace: Double,
        avgNPI: Double,
        avgHeartRate: Double,
        avgCadence: Double? = nil,
        avgVerticalOscillation: Double? = nil,
        avgGroundContactTime: Double? = nil,
        avgStrideLength: Double? = nil,
        formScore: Double? = nil,
        routeData: [RoutePoint] = [],
        formSessionId: UUID? = nil
    ) {
        self.id = UUID()
        self.date = date
        self.distance = distance
        self.duration = duration
        self.avgPace = avgPace
        self.avgNPI = avgNPI
        self.avgHeartRate = avgHeartRate
        self.avgCadence = avgCadence
        self.avgVerticalOscillation = avgVerticalOscillation
        self.avgGroundContactTime = avgGroundContactTime
        self.avgStrideLength = avgStrideLength
        self.formScore = formScore
        self.routeData = routeData
        self.formSessionId = formSessionId
    }
}

struct RoutePoint: Codable {
    let lat: Double
    let lon: Double
    
    init(lat: Double, lon: Double) {
        self.lat = lat
        self.lon = lon
    }
}
