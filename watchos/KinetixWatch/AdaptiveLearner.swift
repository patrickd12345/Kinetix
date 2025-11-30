import Foundation

/// Adaptive learning system that adjusts form coaching thresholds based on observed patterns
class AdaptiveLearner {
    
    // MARK: - Learned Parameters (stored in UserDefaults)
    struct LearnedParameters: Codable {
        // Adaptive thresholds (start with defaults, adjust based on user)
        var cadenceThreshold: Double = 160.0
        var verticalOscillationThreshold: Double = 12.0
        var groundContactTimeThreshold: Double = 300.0
        var strideLengthThreshold: Double = 1.3
        
        // User-specific optimal ranges (learned from good form periods)
        var optimalCadenceMin: Double = 170.0
        var optimalCadenceMax: Double = 185.0
        var optimalVerticalOscillationMax: Double = 10.0
        var optimalGroundContactTimeMax: Double = 250.0
        
        // Confidence scores (how many samples we've seen)
        var sampleCount: Int = 0
        var lastUpdated: Date = Date()
    }
    
    private var parameters: LearnedParameters
    private let userDefaults = UserDefaults.standard
    private let parametersKey = "FormCoachLearnedParameters"
    
    // Track recent recommendations and outcomes
    private var recentRecommendations: [(type: String, timestamp: Date, metricsBefore: FormMetrics)] = []
    private var outcomeTracking: [(recommendationType: String, metricsBefore: FormMetrics, metricsAfter: FormMetrics, improved: Bool)] = []
    
    init() {
        // Load learned parameters or use defaults
        if let data = userDefaults.data(forKey: parametersKey),
           let decoded = try? JSONDecoder().decode(LearnedParameters.self, from: data) {
            self.parameters = decoded
        } else {
            self.parameters = LearnedParameters()
        }
    }
    
    // MARK: - Get Adaptive Thresholds
    func getCadenceThreshold() -> Double {
        return parameters.cadenceThreshold
    }
    
    func getVerticalOscillationThreshold() -> Double {
        return parameters.verticalOscillationThreshold
    }
    
    func getGroundContactTimeThreshold() -> Double {
        return parameters.groundContactTimeThreshold
    }
    
    func getStrideLengthThreshold() -> Double {
        return parameters.strideLengthThreshold
    }
    
    // MARK: - Track Recommendation Outcomes
    /// Called when a recommendation is shown
    func recordRecommendation(type: String, metrics: FormMetrics) {
        recentRecommendations.append((type: type, timestamp: Date(), metricsBefore: metrics))
        
        // Keep only last 20 recommendations
        if recentRecommendations.count > 20 {
            recentRecommendations.removeFirst()
        }
    }
    
    /// Called periodically to check if recommendations led to improvements
    func evaluateOutcomes(currentMetrics: FormMetrics) {
        let now = Date()
        var indicesToRemove: [Int] = []
        
        // Check recommendations from last 30 seconds
        for (index, rec) in recentRecommendations.enumerated() where now.timeIntervalSince(rec.timestamp) < 30 {
            let improved = didImprove(before: rec.metricsBefore, after: currentMetrics, recommendationType: rec.type)
            
            outcomeTracking.append((
                recommendationType: rec.type,
                metricsBefore: rec.metricsBefore,
                metricsAfter: currentMetrics,
                improved: improved
            ))
            
            indicesToRemove.append(index)
        }
        
        // Remove evaluated recommendations (in reverse to maintain indices)
        for index in indicesToRemove.reversed() {
            recentRecommendations.remove(at: index)
        }
        
        // Keep only last 100 outcomes
        if outcomeTracking.count > 100 {
            outcomeTracking.removeFirst(outcomeTracking.count - 100)
        }
        
        // Learn from outcomes every 5 samples (more frequent learning)
        if outcomeTracking.count >= 5 && outcomeTracking.count % 5 == 0 {
            learnFromOutcomes()
        }
    }
    
    // MARK: - Learning Logic
    private func didImprove(before: FormMetrics, after: FormMetrics, recommendationType: String) -> Bool {
        switch recommendationType {
        case "increase_cadence":
            if let cadBefore = before.cadence, let cadAfter = after.cadence {
                return cadAfter > cadBefore
            }
        case "run_flatter":
            if let oscBefore = before.verticalOscillation, let oscAfter = after.verticalOscillation {
                return oscAfter < oscBefore
            }
        case "light_feet":
            if let gctBefore = before.groundContactTime, let gctAfter = after.groundContactTime {
                return gctAfter < gctBefore
            }
        case "overstriding":
            if let strideBefore = before.strideLength, let strideAfter = after.strideLength,
               let cadBefore = before.cadence, let cadAfter = after.cadence {
                return strideAfter < strideBefore || cadAfter > cadBefore
            }
        case "form_degradation", "improve_efficiency":
            // Check if overall form improved (efficiency score)
            if let effBefore = before.runningEfficiency, let effAfter = after.runningEfficiency {
                return effAfter > effBefore
            }
            // Fallback: check if any key metric improved
            if let cadBefore = before.cadence, let cadAfter = after.cadence {
                return cadAfter > cadBefore
            }
        case "good_form":
            // Good form periods - check if metrics stayed good
            if let effAfter = after.runningEfficiency {
                return effAfter >= 75
            }
            return true // Assume good if we said it was good
        default:
            return false
        }
        return false
    }
    
    private func learnFromOutcomes() {
        var updated = false
        let recentOutcomes = Array(outcomeTracking.suffix(20)) // Use most recent 20 for learning
        
        // Analyze outcomes by recommendation type
        let cadenceOutcomes = recentOutcomes.filter { $0.recommendationType == "increase_cadence" }
        if cadenceOutcomes.count >= 3 {
            let successRate = Double(cadenceOutcomes.filter { $0.improved }.count) / Double(cadenceOutcomes.count)
            
            // If success rate is low, threshold might be too strict - adjust
            if successRate < 0.3 {
                // Lower threshold slightly (be less strict) - user might naturally run at lower cadence
                parameters.cadenceThreshold = max(150.0, parameters.cadenceThreshold - 2.0)
                updated = true
            } else if successRate > 0.7 {
                // Success rate high, can be more strict
                parameters.cadenceThreshold = min(170.0, parameters.cadenceThreshold + 1.0)
                updated = true
            }
        }
        
        // Learn optimal ranges from "good form" periods
        let goodFormPeriods = recentOutcomes.filter { $0.recommendationType == "good_form" }
        if goodFormPeriods.count >= 3 {
            let cadences = goodFormPeriods.compactMap { $0.metricsAfter.cadence }
            if !cadences.isEmpty {
                let avgCadence = cadences.reduce(0, +) / Double(cadences.count)
                // Update optimal range based on observed good form (conservative adjustment)
                parameters.optimalCadenceMin = max(160.0, min(parameters.optimalCadenceMin, avgCadence - 8.0))
                parameters.optimalCadenceMax = min(200.0, max(parameters.optimalCadenceMax, avgCadence + 8.0))
                updated = true
            }
        }
        
        // Learn vertical oscillation threshold
        let oscOutcomes = recentOutcomes.filter { $0.recommendationType == "run_flatter" }
        if oscOutcomes.count >= 3 {
            let successRate = Double(oscOutcomes.filter { $0.improved }.count) / Double(oscOutcomes.count)
            if successRate < 0.3 {
                // User might naturally have higher oscillation - be less strict
                parameters.verticalOscillationThreshold = min(15.0, parameters.verticalOscillationThreshold + 1.0)
                updated = true
            } else if successRate > 0.7 {
                // Can be more strict
                parameters.verticalOscillationThreshold = max(10.0, parameters.verticalOscillationThreshold - 0.5)
                updated = true
            }
        }
        
        // Learn ground contact time threshold
        let gctOutcomes = recentOutcomes.filter { $0.recommendationType == "light_feet" }
        if gctOutcomes.count >= 3 {
            let successRate = Double(gctOutcomes.filter { $0.improved }.count) / Double(gctOutcomes.count)
            if successRate < 0.3 {
                parameters.groundContactTimeThreshold = min(350.0, parameters.groundContactTimeThreshold + 10.0)
                updated = true
            } else if successRate > 0.7 {
                parameters.groundContactTimeThreshold = max(250.0, parameters.groundContactTimeThreshold - 5.0)
                updated = true
            }
        }
        
        if updated {
            parameters.sampleCount = outcomeTracking.count
            parameters.lastUpdated = Date()
            saveParameters()
        }
    }
    
    // MARK: - Persistence
    private func saveParameters() {
        if let encoded = try? JSONEncoder().encode(parameters) {
            userDefaults.set(encoded, forKey: parametersKey)
        }
    }
    
    /// Reset learned parameters to defaults
    func reset() {
        parameters = LearnedParameters()
        saveParameters()
        outcomeTracking.removeAll()
        recentRecommendations.removeAll()
    }
    
    /// Get learning statistics
    func getStats() -> (sampleCount: Int, lastUpdated: Date, successRate: Double) {
        let totalOutcomes = outcomeTracking.count
        let successful = outcomeTracking.filter { $0.improved }.count
        let successRate = totalOutcomes > 0 ? Double(successful) / Double(totalOutcomes) : 0.0
        
        return (parameters.sampleCount, parameters.lastUpdated, successRate)
    }
}

