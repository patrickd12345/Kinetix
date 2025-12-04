import Foundation

/// Calculates running metrics: NPI, pace, progress, etc.
class RunMetricsCalculator {

    struct RaceProjection {
        let targetDistanceMeters: Double
        let predictedFinishTime: TimeInterval
        let goalFinishTime: TimeInterval
        let projectedPaceSeconds: Double
        let progress: Double

        func displayString(includeGoal: Bool = true) -> String {
            let finishText = RunMetricsCalculator.formatTime(predictedFinishTime)
            if includeGoal && goalFinishTime > 0 {
                let goalText = RunMetricsCalculator.formatTime(goalFinishTime)
                return "\(finishText)→\(goalText)"
            }

            let paceText = RunMetricsCalculator.formatPace(projectedPaceSeconds)
            return "\(finishText) @\(paceText)"
        }
    }
    
    // MARK: - NPI Calculation
    
    static func calculateNPI(distanceMeters: Double, durationSeconds: Double) -> Double {
        guard distanceMeters > 0, durationSeconds > 0 else { return 0 }

        let paceSeconds = durationSeconds / (distanceMeters / 1000.0)
        let speedKmH = (1000 / paceSeconds) * 3.6
        let factor = pow(distanceMeters / 1000.0, 0.06)
        return speedKmH * factor * 10.0
    }

    // MARK: - NPI <-> Pace/Time Conversion

    static func paceSeconds(forNPI npi: Double, distanceMeters: Double) -> Double {
        guard npi > 0, distanceMeters > 0 else { return 0 }

        let distanceKm = distanceMeters / 1000.0
        let factor = pow(distanceKm, 0.06)
        let speedKmH = npi / (factor * 10.0)
        guard speedKmH > 0 else { return 0 }

        return 3600.0 / speedKmH
    }

    static func finishTime(fromNPI npi: Double, distanceMeters: Double) -> TimeInterval {
        let pace = paceSeconds(forNPI: npi, distanceMeters: distanceMeters)
        guard pace > 0 else { return 0 }

        return pace * (distanceMeters / 1000.0)
    }

    static func projectRaceTime(
        currentNPI: Double,
        goalNPI: Double,
        elapsedSeconds: Double,
        distanceCoveredMeters: Double,
        targetDistanceMeters: Double
    ) -> RaceProjection? {
        guard currentNPI > 0, targetDistanceMeters > 0 else { return nil }
        guard targetDistanceMeters >= distanceCoveredMeters else {
            let pace = paceSeconds(forNPI: currentNPI, distanceMeters: targetDistanceMeters)
            return RaceProjection(
                targetDistanceMeters: targetDistanceMeters,
                predictedFinishTime: elapsedSeconds,
                goalFinishTime: finishTime(fromNPI: goalNPI, distanceMeters: targetDistanceMeters),
                projectedPaceSeconds: pace,
                progress: 1.0
            )
        }

        let projectedFinish = finishTime(fromNPI: currentNPI, distanceMeters: targetDistanceMeters)
        guard projectedFinish > 0 else { return nil }

        let goalFinish = goalNPI > 0 ? finishTime(fromNPI: goalNPI, distanceMeters: targetDistanceMeters) : 0
        let progress = min(max(elapsedSeconds / projectedFinish, 0.0), 1.0)
        let pace = paceSeconds(forNPI: currentNPI, distanceMeters: targetDistanceMeters)

        return RaceProjection(
            targetDistanceMeters: targetDistanceMeters,
            predictedFinishTime: projectedFinish,
            goalFinishTime: goalFinish,
            projectedPaceSeconds: pace,
            progress: progress
        )
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
        targetNPI: Double
    ) -> Double {
        guard rollingPace > 0, targetNPI > 0 else { return 0 }

        // Predict total time needed to hit target NPI at current pace
        // This is a simplified calculation - adjust based on your NPI model
        let predictedTotalTime = estimateTimeForNPI(targetNPI: targetNPI, currentPace: rollingPace)

        guard predictedTotalTime > 0 else { return 0 }
        
        let progress = elapsedTime / predictedTotalTime
        return min(max(progress, 0.0), 1.0) // Clamp between 0 and 1
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
    
    private static func estimateTimeForNPI(targetNPI: Double, currentPace: Double) -> TimeInterval {
        // Simplified: assume a standard distance (e.g., 5km) for prediction
        // You may want to adjust this based on your actual NPI model
        let standardDistance: Double = 5000 // 5km in meters
        
        // Reverse NPI calculation to estimate time
        // NPI = (speed * factor * 10) where speed = 3.6 / (pace / 1000)
        // Solving for time: time = distance * pace
        // But we need to account for the NPI factor
        
        // This is a placeholder - adjust based on your actual NPI formula
        let estimatedTime = standardDistance * (currentPace / 1000.0)
        return estimatedTime
    }
}







