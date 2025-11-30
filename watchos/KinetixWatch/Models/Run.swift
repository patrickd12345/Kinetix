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
    var routeData: [RoutePoint] = []
    
    init(date: Date = Date(), distance: Double, duration: TimeInterval, avgPace: Double, avgNPI: Double, avgHeartRate: Double, routeData: [RoutePoint] = []) {
        self.id = UUID()
        self.date = date
        self.distance = distance
        self.duration = duration
        self.avgPace = avgPace
        self.avgNPI = avgNPI
        self.avgHeartRate = avgHeartRate
        self.routeData = routeData
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
