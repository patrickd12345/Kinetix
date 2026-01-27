import Foundation
import SwiftData

@Model
public final class Run {
    public var id: UUID
    public var date: Date
    public var source: String
    public var distance: Double // in meters
    public var duration: TimeInterval // in seconds
    public var avgPace: Double // seconds per km
    public var kps: Double // 0–100
    public var setPb: Bool
    public var avgHeartRate: Double
    public var avgCadence: Double?
    public var avgVerticalOscillation: Double?
    public var avgGroundContactTime: Double?
    public var avgStrideLength: Double?
    public var formScore: Double?
    public var routeData: [RoutePoint] = []
    public var formSessionId: UUID? // Link to Form Monitor samples when applicable
    public var elevationGain: Double? // Elevation gain in meters
    
    public init(
        date: Date = Date(),
        source: String = "recorded",
        distance: Double,
        duration: TimeInterval,
        avgPace: Double,
        kps: Double,
        setPb: Bool,
        avgHeartRate: Double,
        avgCadence: Double? = nil,
        avgVerticalOscillation: Double? = nil,
        avgGroundContactTime: Double? = nil,
        avgStrideLength: Double? = nil,
        formScore: Double? = nil,
        routeData: [RoutePoint] = [],
        formSessionId: UUID? = nil,
        elevationGain: Double? = nil
    ) {
        self.id = UUID()
        self.date = date
        self.source = source
        self.distance = distance
        self.duration = duration
        self.avgPace = avgPace
        self.kps = kps
        self.setPb = setPb
        self.avgHeartRate = avgHeartRate
        self.avgCadence = avgCadence
        self.avgVerticalOscillation = avgVerticalOscillation
        self.avgGroundContactTime = avgGroundContactTime
        self.avgStrideLength = avgStrideLength
        self.formScore = formScore
        self.routeData = routeData
        self.formSessionId = formSessionId
        self.elevationGain = elevationGain
    }
}

public struct RoutePoint: Codable {
    public let lat: Double
    public let lon: Double
    
    public init(lat: Double, lon: Double) {
        self.lat = lat
        self.lon = lon
    }
}

// MARK: - Run Payload for syncing between Watch and iPhone
public struct RunPayload: Codable, Identifiable {
    public let id: UUID
    public let date: Date
    public let source: String
    public let distance: Double
    public let duration: TimeInterval
    public let avgPace: Double
    public let kps: Double
    public let setPb: Bool
    public let avgHeartRate: Double
    public let avgCadence: Double?
    public let avgVerticalOscillation: Double?
    public let avgGroundContactTime: Double?
    public let avgStrideLength: Double?
    public let formScore: Double?
    public let routeData: [RoutePoint]
    public let formSessionId: UUID?
    public let elevationGain: Double?
    
    public init(from run: Run) {
        self.id = run.id
        self.date = run.date
        self.source = run.source
        self.distance = run.distance
        self.duration = run.duration
        self.avgPace = run.avgPace
        self.kps = run.kps
        self.setPb = run.setPb
        self.avgHeartRate = run.avgHeartRate
        self.avgCadence = run.avgCadence
        self.avgVerticalOscillation = run.avgVerticalOscillation
        self.avgGroundContactTime = run.avgGroundContactTime
        self.avgStrideLength = run.avgStrideLength
        self.formScore = run.formScore
        self.routeData = run.routeData
        self.formSessionId = run.formSessionId
        self.elevationGain = run.elevationGain
    }
}
