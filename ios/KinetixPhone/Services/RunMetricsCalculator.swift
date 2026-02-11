import Foundation

/// Calculates running metrics: NPI, pace, etc. (matches Watch implementation)
class RunMetricsCalculator {
    
    // MARK: - NPI Validation
    
    /// Validates that a run has valid data for NPI calculation
    static func isValidRunForNPI(distanceMeters: Double, durationSeconds: Double) -> Bool {
        return distanceMeters > 0 &&
               durationSeconds > 0 &&
               distanceMeters.isFinite &&
               durationSeconds.isFinite &&
               !distanceMeters.isNaN &&
               !durationSeconds.isNaN
    }
    
    /// Validates that an NPI value is valid
    static func isValidNPI(_ npi: Double) -> Bool {
        return npi > 0 && npi.isFinite && !npi.isNaN
    }
    
    // MARK: - NPI Calculation
    
    static func calculateNPI(distanceMeters: Double, durationSeconds: Double) -> Double {
        guard isValidRunForNPI(distanceMeters: distanceMeters, durationSeconds: durationSeconds) else {
            return 0
        }

        let paceSeconds = durationSeconds / (distanceMeters / 1000.0)
        
        // Guard against invalid pace calculations
        guard paceSeconds.isFinite && paceSeconds > 0 && !paceSeconds.isNaN else {
            return 0
        }
        
        let speedKmH = (1000 / paceSeconds) * 3.6
        let factor = pow(distanceMeters / 1000.0, 0.06)
        let npi = speedKmH * factor * 10.0
        
        // Validate the result
        guard isValidNPI(npi) else {
            return 0
        }
        
        return npi
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




