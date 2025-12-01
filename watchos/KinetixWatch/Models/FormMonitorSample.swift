import Foundation
import SwiftData

@Model
final class FormMonitorSample {
    var id: UUID
    var sessionId: UUID
    var timestamp: Date
    
    // Bubble representation
    var bubbleX: Double
    var bubbleY: Double
    var instability: Double
    var symmetry: Double
    
    // Raw metrics for heatmap reconstruction
    var cadence: Double?
    var verticalOscillation: Double?
    var strideLength: Double?
    var groundContactTime: Double?
    var pace: Double?
    var leftRightBalance: Double?
    var rollingPace: Double?
    
    init(
        id: UUID = UUID(),
        sessionId: UUID,
        timestamp: Date = .now,
        bubbleX: Double,
        bubbleY: Double,
        instability: Double,
        symmetry: Double,
        cadence: Double? = nil,
        verticalOscillation: Double? = nil,
        strideLength: Double? = nil,
        groundContactTime: Double? = nil,
        pace: Double? = nil,
        leftRightBalance: Double? = nil,
        rollingPace: Double? = nil
    ) {
        self.id = id
        self.sessionId = sessionId
        self.timestamp = timestamp
        self.bubbleX = bubbleX
        self.bubbleY = bubbleY
        self.instability = instability
        self.symmetry = symmetry
        self.cadence = cadence
        self.verticalOscillation = verticalOscillation
        self.strideLength = strideLength
        self.groundContactTime = groundContactTime
        self.pace = pace
        self.leftRightBalance = leftRightBalance
        self.rollingPace = rollingPace
    }
}

struct FormMonitorSamplePayload: Codable {
    var id: UUID
    var sessionId: UUID
    var timestamp: Date
    var bubbleX: Double
    var bubbleY: Double
    var instability: Double
    var symmetry: Double
    var cadence: Double?
    var verticalOscillation: Double?
    var strideLength: Double?
    var groundContactTime: Double?
    var pace: Double?
    var leftRightBalance: Double?
    var rollingPace: Double?
    
    init(sample: FormMonitorSample) {
        self.id = sample.id
        self.sessionId = sample.sessionId
        self.timestamp = sample.timestamp
        self.bubbleX = sample.bubbleX
        self.bubbleY = sample.bubbleY
        self.instability = sample.instability
        self.symmetry = sample.symmetry
        self.cadence = sample.cadence
        self.verticalOscillation = sample.verticalOscillation
        self.strideLength = sample.strideLength
        self.groundContactTime = sample.groundContactTime
        self.pace = sample.pace
        self.leftRightBalance = sample.leftRightBalance
        self.rollingPace = sample.rollingPace
    }
}
