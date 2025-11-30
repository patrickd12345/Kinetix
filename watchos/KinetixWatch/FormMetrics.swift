import Foundation

public struct FormMetrics {
    // Rolling/display pace in seconds per km (or adjusted per unit)
    public var pace: Double? = nil
    // Total distance in meters
    public var distance: Double? = nil
    // Steps per minute
    public var cadence: Double? = nil
    // Beats per minute
    public var heartRate: Double? = nil
    // Vertical oscillation in centimeters
    public var verticalOscillation: Double? = nil
    // Stride length in meters
    public var strideLength: Double? = nil
    // Ground contact time in milliseconds
    public var groundContactTime: Double? = nil
    
    public init() {}
}
