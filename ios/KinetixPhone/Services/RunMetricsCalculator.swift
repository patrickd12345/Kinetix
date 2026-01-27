import Foundation

/// Calculates running metrics: KPS, pace, etc. (matches Watch implementation)
class RunMetricsCalculator {
    
    // MARK: - KPS Calculation
    
    static func calculateKps(distanceMeters: Double, durationSeconds: Double, pbEq5kSec: Double?) -> Double {
        return KpsCalculator.computeKps(distanceMeters: distanceMeters, durationSeconds: durationSeconds, pbEq5kSec: pbEq5kSec).kps
    }
    
    static func formatPace(_ paceSeconds: Double) -> String {
        if paceSeconds.isInfinite || paceSeconds.isNaN { return "0:00" }
        if paceSeconds > 359999 { return "0:00" }
        let minutes = Int(paceSeconds) / 60
        let seconds = Int(paceSeconds) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
    
    static func formatTime(_ seconds: TimeInterval) -> String {
        let hours = Int(seconds) / 3600
        let minutes = (Int(seconds) % 3600) / 60
        let secs = Int(seconds) % 60
        
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        } else {
            return String(format: "%d:%02d", minutes, secs)
        }
    }
}




