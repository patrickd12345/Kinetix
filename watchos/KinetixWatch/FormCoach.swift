import Foundation
import CoreML

// MARK: - Types
public enum RecommendationType {
    case good
    case warning
    case alert
}

// MARK: - Coach Mode
public enum CoachMode: String, Codable {
    case ruleBased = "rule_based"
    case coreML = "core_ml"
    case auto = "auto" // Automatically switch when ready
}

struct FormRecommendation: Identifiable {
    let id = UUID()
    let message: String
    let detail: String
    let type: RecommendationType
    let timestamp: Date
}

class FormCoach: ObservableObject {
    @Published var currentRecommendation: FormRecommendation?
    @Published var currentMode: CoachMode = .auto
    @Published var modeDescription: String = "Auto (Rule-Based)"
    
    // Adaptive learning system
    private let learner = AdaptiveLearner()
    
    // Core ML coach (when model available)
    private let coreMLCoach = CoreMLCoach()
    
    // Mode management
    private let userDefaults = UserDefaults.standard
    private let modeKey = "FormCoachMode"
    private let trainingSamplesKey = "FormCoachTrainingSamples"
    
    private var lastAnalysisTime = Date()
    private let analysisInterval: TimeInterval = 5.0 // Run every 5 seconds
    
    // History for smoothing
    private var recentMetrics: [FormMetrics] = []
    
    // Track metrics before recommendation to evaluate outcomes
    private var metricsBeforeRecommendation: FormMetrics?
    
    // Data logging for ML training
    private var loggedSamples: [(metrics: FormMetrics, recommendation: String?)] = []
    
    init() {
        loadMode()
        updateModeDescription()
    }
    
    func evaluate(metrics: FormMetrics) {
        let now = Date()
        guard now.timeIntervalSince(lastAnalysisTime) >= analysisInterval else { return }
        
        recentMetrics.append(metrics)
        if recentMetrics.count > 5 { recentMetrics.removeFirst() }
        
        // Smooth metrics
        let smoothed = smoothMetrics(recentMetrics)
        
        // Evaluate outcomes from previous recommendations (learning)
        learner.evaluateOutcomes(currentMetrics: smoothed)
        
        // Generate recommendation using selected coach
        var newRec: FormRecommendation?
        var recommendationType: String?
        
        // Try Core ML first if enabled (model included from start)
        if shouldUseCoreML() {
            newRec = coreMLCoach.predict(metrics: smoothed)
            if newRec != nil {
                recommendationType = "core_ml_prediction"
            }
        }
        
        // Fallback to rule-based if Core ML didn't provide recommendation
        if newRec == nil {
            let enriched = enrichMetrics(smoothed)
            let result = generateRuleBasedRecommendation(enriched)
            newRec = result.0
            recommendationType = result.1
        }
        
        // Update Core ML adaptive learning from outcomes
        if _ newRec, let type = recommendationType, let before = metricsBeforeRecommendation {
            // Track outcome for adaptive learning
            let improved = didRecommendationImproveForm(before: before, after: smoothed, type: type)
            coreMLCoach.updateFromOutcome(
                metricsBefore: before,
                metricsAfter: smoothed,
                recommendationType: type,
                improved: improved
            )
        }
        
        // Record recommendation for learning
        if _ newRec, let type = recommendationType {
            metricsBeforeRecommendation = smoothed
            learner.recordRecommendation(type: type, metrics: smoothed)
        }
        
        DispatchQueue.main.async {
            self.currentRecommendation = newRec
            self.lastAnalysisTime = now
        }
        
        // Log data for ML training (always, not just DEBUG)
        let recLabel = newRec?.message.lowercased().replacingOccurrences(of: " ", with: "_") ?? "good_form"
        loggedSamples.append((metrics: smoothed, recommendation: recLabel))
        
        // Save training sample count
        let sampleCount = getTrainingSampleCount()
        userDefaults.set(sampleCount + 1, forKey: trainingSamplesKey)
        
        // Log to console every 10 samples
        if loggedSamples.count % 10 == 0 {
            print("[FormCoach] Logged \(loggedSamples.count) samples (Total: \(sampleCount + 1))")
        }
    }
    
    // MARK: - Training Data Export
    /// Export logged data as CSV for ML training
    func exportTrainingData() -> String {
        var csv = "cadence,vertical_oscillation,ground_contact_time,stride_length,heart_rate,pace,distance,recommendation\n"
        
        for sample in loggedSamples {
            let m = sample.metrics
            csv += String(format: "%.2f,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f,%@\n",
                         m.cadence ?? 0,
                         m.verticalOscillation ?? 0,
                         m.groundContactTime ?? 0,
                         m.strideLength ?? 0,
                         m.heartRate ?? 0,
                         m.pace ?? 0,
                         m.distance ?? 0,
                         sample.recommendation ?? "good_form")
        }
        
        return csv
    }
    
    func clearLoggedData() {
        loggedSamples.removeAll()
        userDefaults.set(0, forKey: trainingSamplesKey)
    }
    
    func getTrainingSampleCount() -> Int {
        return userDefaults.integer(forKey: trainingSamplesKey)
    }
    
    // MARK: - Learning Statistics
    func getLearningStats() -> (sampleCount: Int, lastUpdated: Date, successRate: Double) {
        return learner.getStats()
    }
    
    func resetLearning() {
        learner.reset()
    }
    
    // MARK: - Coach Mode Management
    func setMode(_ mode: CoachMode) {
        currentMode = mode
        saveMode()
        updateModeDescription()
    }
    
    private func loadMode() {
        if let modeString = userDefaults.string(forKey: modeKey),
           let mode = CoachMode(rawValue: modeString) {
            currentMode = mode
        } else {
            currentMode = .auto // Default to auto
        }
    }
    
    private func saveMode() {
        userDefaults.set(currentMode.rawValue, forKey: modeKey)
    }
    
    private func updateModeDescription() {
        switch currentMode {
        case .ruleBased:
            modeDescription = "Rule-Based"
        case .coreML:
            if coreMLCoach.isModelAvailable() {
                modeDescription = "Core ML"
            } else {
                modeDescription = "Core ML (Model Not Available)"
            }
        case .auto:
            if shouldUseCoreML() {
                modeDescription = "Auto (Core ML - Learning)"
            } else {
                modeDescription = "Auto (Rule-Based)"
            }
        }
    }
    
    private func shouldUseCoreML() -> Bool {
        switch currentMode {
        case .coreML:
            return coreMLCoach.isModelAvailable()
        case .ruleBased:
            return false
        case .auto:
            // Model is included from start, use it immediately
            return coreMLCoach.isModelAvailable()
        }
    }
    
    /// Check if recommendation improved form
    private func didRecommendationImproveForm(before: FormMetrics, after: FormMetrics, type: String) -> Bool {
        switch type {
        case "increase_cadence", "core_ml_prediction":
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
        default:
            return false
        }
        return false
    }
    
    // MARK: - Rule-Based Recommendation Generation
    private func generateRuleBasedRecommendation(_ enriched: FormMetrics) -> (FormRecommendation?, String?) {
        var newRec: FormRecommendation?
        var recommendationType: String?
        
        let cadenceThreshold = learner.getCadenceThreshold()
        let oscThreshold = learner.getVerticalOscillationThreshold()
        let gctThreshold = learner.getGroundContactTimeThreshold()
        let strideThreshold = learner.getStrideLengthThreshold()
        
        // Priority-based analysis (same as before)
        // 1. OVERSTRIDING (Critical)
        if let stride = enriched.strideLength, let cad = enriched.cadence,
           stride > strideThreshold && cad < cadenceThreshold {
            let stepLen = stride / 2.0
            if stepLen > 0.7 {
                newRec = FormRecommendation(
                    message: "Overstriding",
                    detail: "Land under hips, shorten stride",
                    type: .alert,
                    timestamp: Date()
                )
                recommendationType = "overstriding"
                return (newRec, recommendationType)
            }
        }
        
        // 2. LOW CADENCE
        if let cad = enriched.cadence, cad < cadenceThreshold {
            newRec = FormRecommendation(
                message: "Increase Cadence",
                detail: "Aim for 170-180 spm, quicker steps",
                type: .warning,
                timestamp: Date()
            )
            recommendationType = "increase_cadence"
            return (newRec, recommendationType)
        }
        
        // 3. EXCESSIVE VERTICAL OSCILLATION
        if let osc = enriched.verticalOscillation, osc > oscThreshold {
            newRec = FormRecommendation(
                message: "Run Flatter",
                detail: "Reduce bounce (\(Int(osc))cm), focus forward",
                type: .warning,
                timestamp: Date()
            )
            recommendationType = "run_flatter"
            return (newRec, recommendationType)
        }
        
        // 4. LONG GROUND CONTACT TIME
        if let gct = enriched.groundContactTime, gct > gctThreshold {
            newRec = FormRecommendation(
                message: "Light Feet",
                detail: "Quicker turnover, \(Int(gct))ms contact",
                type: .warning,
                timestamp: Date()
            )
            recommendationType = "light_feet"
            return (newRec, recommendationType)
        }
        
        // 5. FORM DEGRADATION
        if recentMetrics.count >= 3 {
            let formTrend = analyzeFormTrend(recentMetrics)
            if formTrend.isDegrading {
                newRec = FormRecommendation(
                    message: "Form Slipping",
                    detail: formTrend.reason,
                    type: .warning,
                    timestamp: Date()
                )
                recommendationType = "form_degradation"
                return (newRec, recommendationType)
            }
        }
        
        // 6. RUNNING EFFICIENCY
        if let efficiency = enriched.runningEfficiency, efficiency < 60 {
            if let cad = enriched.cadence, cad < 165 {
                newRec = FormRecommendation(
                    message: "Improve Efficiency",
                    detail: "Increase cadence, reduce bounce",
                    type: .warning,
                    timestamp: Date()
                )
                recommendationType = "improve_efficiency"
                return (newRec, recommendationType)
            }
        }
        
        // 7. POSITIVE REINFORCEMENT
        let formQuality = calculateFormQuality(enriched)
        if formQuality >= 80 {
            if Int.random(in: 0...15) == 0 {
                newRec = FormRecommendation(
                    message: "Great Form!",
                    detail: "Maintain this efficiency",
                    type: .good,
                    timestamp: Date()
                )
                recommendationType = "good_form"
            }
        }
        
        return (newRec, recommendationType)
    }
    
    private func smoothMetrics(_ history: [FormMetrics]) -> FormMetrics {
        guard !history.isEmpty else { return FormMetrics() }
        
        // Weighted average (more recent = higher weight)
        _Weight: Double = 0
        var weightedOsc: Double = 0
        var weightedStride: Double = 0
        var weightedGCT: Double = 0
        var weightedCad: Double = 0
        
        for (index, metric) in history.enumerated() {
            let weight = Double(index + 1) // More recent = higher weight
            totalWeight += weight
            
            if let osc = metric.verticalOscillation {
                weightedOsc += osc * weight
            }
            if let stride = metric.strideLength {
                weightedStride += stride * weight
            }
            if let gct = metric.groundContactTime {
                weightedGCT += gct * weight
            }
            if let cad = metric.cadence {
                weightedCad += cad * weight
            }
        }
        
        let oscValues = history.compactMap(\.verticalOscillation)
        let strideValues = history.compactMap(\.strideLength)
        let gctValues = history.compactMap(\.groundContactTime)
        let cadValues = history.compactMap(\.cadence)
        
        var metrics = FormMetrics()
        metrics.verticalOscillation = oscValues.isEmpty ? nil : weightedOsc / totalWeight
        metrics.strideLength = strideValues.isEmpty ? nil : weightedStride / totalWeight
        metrics.groundContactTime = gctValues.isEmpty ? nil : weightedGCT / totalWeight
        metrics.cadence = cadValues.isEmpty ? nil : weightedCad / totalWeight
        metrics.heartRate = history.last?.heartRate
        metrics.pace = history.last?.pace
        metrics.distance = history.last?.distance
        return metrics
    }
    
    // MARK: - Comprehensive Form Analysis
    
    /// Enrich metrics with derived calculations based on running biomechanics
    /// Note: Computed properties (stepLength, runningEfficiency, legStiffness, formScore) are automatically calculated
    private func enrichMetrics(_ metrics: FormMetrics) -> FormMetrics {
        // Computed properties are automatically available, no need to assign
        return metrics
    }
    
    
    /// Analyze form trend over time to detect degradation
    private func analyzeFormTrend(_ history: [FormMetrics]) -> (isDegrading: Bool, reason: String) {
        guard history.count >= 3 else { return (false, "") }
        
        let recent = Array(history.suffix(3))
        let older = Array(history.prefix(max(1, history.count - 3)))
        
        // Check cadence trend
        let recentCad = recent.compactMap(\.cadence).reduce(0, +) / Double(recent.compactMap(\.cadence).count)
        let olderCad = older.compactMap(\.cadence).reduce(0, +) / Double(older.compactMap(\.cadence).count)
        
        if recentCad < olderCad - 5 && recentCad > 0 && olderCad > 0 {
            return (true, "Cadence dropping, focus on turnover")
        }
        
        // Check vertical oscillation trend
        let recentOsc = recent.compactMap(\.verticalOscillation).reduce(0, +) / Double(recent.compactMap(\.verticalOscillation).count)
        let olderOsc = older.compactMap(\.verticalOscillation).reduce(0, +) / Double(older.compactMap(\.verticalOscillation).count)
        
        if recentOsc > olderOsc + 2 && recentOsc > 0 && olderOsc > 0 {
            return (true, "Bounce increasing, run flatter")
        }
        
        // Check ground contact time trend
        let recentGCT = recent.compactMap(\.groundContactTime).reduce(0, +) / Double(recent.compactMap(\.groundContactTime).count)
        let olderGCT = older.compactMap(\.groundContactTime).reduce(0, +) / Double(older.compactMap(\.groundContactTime).count)
        
        if recentGCT > olderGCT + 20 && recentGCT > 0 && olderGCT > 0 {
            return (true, "Contact time increasing, lighten up")
        }
        
        return (false, "")
    }
    
    /// Calculate overall form quality score
    private func calculateFormQuality(_ metrics: FormMetrics) -> Double {
        return metrics.formScore ?? metrics.runningEfficiency ?? 50.0
    }
}

