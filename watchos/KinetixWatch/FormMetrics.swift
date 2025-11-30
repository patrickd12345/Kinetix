import Foundation

public struct FormMetrics: Equatable {
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
    
    // MARK: - Derived Metrics
    
    /// Single step length (stride / 2)
    public var stepLength: Double? {
        guard let stride = strideLength else { return nil }
        return stride / 2.0
    }
    
    /// Running efficiency score (higher is better)
    public var runningEfficiency: Double? {
        guard let cad = cadence, let vo = verticalOscillation else { return nil }
        return cad / (vo + 1.0) // Higher is better
    }
    
    /// Leg stiffness estimate (higher is better)
    public var legStiffness: Double? {
        guard let cad = cadence, let gct = groundContactTime else { return nil }
        return cad / (gct + 0.001) // Higher is better
    }
    
    /// Overall form quality score (0-100)
    public var formScore: Double? {
        guard let eff = runningEfficiency, let stiff = legStiffness else { return nil }
        return min(100, (eff * 0.6 + stiff * 0.4) * 10)
    }
}
