import Foundation

public struct FormMetrics: Equatable {
    public var pace: Double? = nil
    public var distance: Double? = nil
    public var cadence: Double? = nil
    public var heartRate: Double? = nil
    public var verticalOscillation: Double? = nil
    public var strideLength: Double? = nil
    public var groundContactTime: Double? = nil
    public var leftRightBalance: Double? = nil
    
    public init() {}
    
    public var stepLength: Double? {
        guard let stride = strideLength else { return nil }
        return stride / 2.0
    }
    
    public var runningEfficiency: Double? {
        guard let cad = cadence, let vo = verticalOscillation else { return nil }
        return cad / (vo + 1.0)
    }
    
    public var legStiffness: Double? {
        guard let cad = cadence, let gct = groundContactTime else { return nil }
        return cad / (gct + 0.001)
    }
    
    public var formScore: Double? {
        guard let eff = runningEfficiency, let stiff = legStiffness else { return nil }
        return min(100, (eff * 0.6 + stiff * 0.4) * 10)
    }
}
