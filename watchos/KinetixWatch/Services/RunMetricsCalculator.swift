import Foundation

/// Calculates running metrics: KPS, pace, progress, etc.
class RunMetricsCalculator {
    struct TargetProjection {
        let timeToBeat: String?
        let progress: Double
    }
    
    // MARK: - KPS
    
    static func calculateKps(distanceMeters: Double, durationSeconds: Double, pbEq5kSec: Double?) -> Double {
        return KpsCalculator.computeKps(distanceMeters: distanceMeters, durationSeconds: durationSeconds, pbEq5kSec: pbEq5kSec).kps
    }
    
    // MARK: - Pace Calculation
    
    static func calculatePace(distanceMeters: Double, durationSeconds: Double) -> Double {
        guard distanceMeters > 0, durationSeconds > 0 else { return 0 }
        return durationSeconds / (distanceMeters / 1000.0) // seconds per km
    }
    
    // MARK: - Rolling Average Pace (5-second window)
    
    static func updateRollingPace(buffer: inout [(Date, Double)], currentPace: Double, windowSeconds: Double = 5.0) -> Double {
        let now = Date()
        buffer.append((now, currentPace))
        
        // Remove old entries outside window
        let cutoff = now.addingTimeInterval(-windowSeconds)
        buffer.removeAll { $0.0 < cutoff }
        
        // Calculate average
        guard !buffer.isEmpty else { return 0 }
        let sum = buffer.reduce(0.0) { $0 + $1.1 }
        return sum / Double(buffer.count)
    }
    
    // MARK: - Progress Gauge (MeBeatMe preset)
    
    static func calculateProgress(
        elapsedTime: TimeInterval,
        rollingPace: Double,
        targetKps: Double,
        pbEq5kSec: Double?
    ) -> Double {
        guard rollingPace.isFinite, rollingPace > 0 else { return 0 }
        guard let pb = pbEq5kSec, pb.isFinite, pb > 0 else { return 0 }
        guard targetKps.isFinite, targetKps > 0 else { return 0 }
        
        let desiredEq5kSec = pb * (100.0 / targetKps)
        let numerator = rollingPace * pow(KpsCalculator.referenceDistanceKm, KpsCalculator.riegelExponent)
        let ratio = numerator / desiredEq5kSec
        guard ratio.isFinite, ratio > 0 else { return 0 }
        
        // d = (pace * 5^1.06 / eq5k)^(1/0.06)
        let distanceNeededKm = pow(ratio, 1.0 / (KpsCalculator.riegelExponent - 1.0))
        guard distanceNeededKm.isFinite, distanceNeededKm > 0 else { return 0 }
        
        let predictedTotalTime = distanceNeededKm * rollingPace
        guard predictedTotalTime.isFinite, predictedTotalTime > 0 else { return 0 }
        
        return min(max(elapsedTime / predictedTotalTime, 0.0), 1.0)
    }
    
    // MARK: - Private Helpers

    static func formatTime(_ seconds: TimeInterval) -> String {
        guard seconds.isFinite && seconds > 0 else { return "0:00" }
        let m = Int(seconds) / 60
        let s = Int(seconds.truncatingRemainder(dividingBy: 60))
        return String(format: "%d:%02d", m, s)
    }

    static func formatPace(_ secondsPerKm: Double) -> String {
        guard secondsPerKm.isFinite && secondsPerKm > 0 else { return "0:00" }
        let m = Int(secondsPerKm) / 60
        let s = Int(secondsPerKm.truncatingRemainder(dividingBy: 60))
        return String(format: "%d:%02d", m, s)
    }
    
}










