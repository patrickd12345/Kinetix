import Foundation

/// Calculates running metrics: NPI, pace, etc. (matches Watch implementation)
class RunMetricsCalculator {
    
    // MARK: - NPI Calculation
    
    static func calculateNPI(distanceMeters: Double, durationSeconds: Double) -> Double {
        guard distanceMeters > 0, durationSeconds > 0 else { return 0 }

        let paceSeconds = durationSeconds / (distanceMeters / 1000.0)
        let speedKmH = (1000 / paceSeconds) * 3.6
        let factor = pow(distanceMeters / 1000.0, 0.06)
        return speedKmH * factor * 10.0
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




