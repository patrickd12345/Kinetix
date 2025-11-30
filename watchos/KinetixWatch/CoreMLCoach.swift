import Foundation
import CoreML

/// Core ML-based form coach with on-device adaptive learning
/// Model is included from the start (bootstrap) and improves through adaptive thresholds
class CoreMLCoach {
    
    // Adaptive thresholds that adjust based on real-world data
    private var adaptiveThresholds: AdaptiveThresholds
    private let userDefaults = UserDefaults.standard
    private let thresholdsKey = "CoreMLAdaptiveThresholds"
    
    private var model: MLModel?
    private var isAvailable: Bool = false
    
    struct AdaptiveThresholds: Codable {
        var cadenceMultiplier: Double = 1.0 // Adjusts model's cadence sensitivity
        var oscillationMultiplier: Double = 1.0
        var gctMultiplier: Double = 1.0
        var strideMultiplier: Double = 1.0
        var confidenceThreshold: Double = 0.6 // Minimum confidence to use model
        var sampleCount: Int = 0
    }
    
    init() {
        loadAdaptiveThresholds()
        loadModel()
    }
    
    /// Load adaptive thresholds (learned from real runs)
    private func loadAdaptiveThresholds() {
        if let data = userDefaults.data(forKey: thresholdsKey),
           let decoded = try? JSONDecoder().decode(AdaptiveThresholds.self, from: data) {
            adaptiveThresholds = decoded
        } else {
            adaptiveThresholds = AdaptiveThresholds()
        }
    }
    
    /// Save adaptive thresholds
    private func saveAdaptiveThresholds() {
        if let encoded = try? JSONEncoder().encode(adaptiveThresholds) {
            userDefaults.set(encoded, forKey: thresholdsKey)
        }
    }
    
    /// Load Core ML model (bootstrap model included from start)
    private func loadModel() {
        // Try to load the model - should be included in bundle from start
        guard let modelURL = Bundle.main.url(forResource: "FormCoachModel", withExtension: "mlmodelc") else {
            // If model not found, we'll use rule-based fallback
            // But ideally, bootstrap model should be included
            print("[CoreMLCoach] Bootstrap model not found - using rule-based fallback")
            isAvailable = false
            return
        }
        
        do {
            let config = MLModelConfiguration()
            model = try MLModel(contentsOf: modelURL, configuration: config)
            isAvailable = true
            print("[CoreMLCoach] Bootstrap model loaded successfully")
        } catch {
            print("[CoreMLCoach] Failed to load model: \(error)")
            isAvailable = false
        }
    }
    
    /// Update adaptive thresholds based on outcomes (on-device learning)
    func updateFromOutcome(metricsBefore: FormMetrics, metricsAfter: FormMetrics, recommendationType: String, improved: Bool) {
        adaptiveThresholds.sampleCount += 1
        
        // Adjust thresholds based on outcomes
        // If recommendation helped, we can be more confident
        // If it didn't help, adjust multipliers to be more conservative
        
        switch recommendationType {
        case "increase_cadence":
            if improved {
                // Success - can be slightly more aggressive
                adaptiveThresholds.cadenceMultiplier = min(1.1, adaptiveThresholds.cadenceMultiplier + 0.01)
            } else {
                // Didn't help - be more conservative
                adaptiveThresholds.cadenceMultiplier = max(0.9, adaptiveThresholds.cadenceMultiplier - 0.01)
            }
        case "run_flatter":
            if improved {
                adaptiveThresholds.oscillationMultiplier = min(1.1, adaptiveThresholds.oscillationMultiplier + 0.01)
            } else {
                adaptiveThresholds.oscillationMultiplier = max(0.9, adaptiveThresholds.oscillationMultiplier - 0.01)
            }
        case "light_feet":
            if improved {
                adaptiveThresholds.gctMultiplier = min(1.1, adaptiveThresholds.gctMultiplier + 0.01)
            } else {
                adaptiveThresholds.gctMultiplier = max(0.9, adaptiveThresholds.gctMultiplier - 0.01)
            }
        default:
            break
        }
        
        // Adjust confidence threshold based on overall success rate
        // (This would need to be calculated from outcome history)
        
        saveAdaptiveThresholds()
    }
    
    /// Check if Core ML model is available
    func isModelAvailable() -> Bool {
        return isAvailable && model != nil
    }
    
    /// Generate recommendation using Core ML model with adaptive thresholds
    func predict(metrics: FormMetrics) -> FormRecommendation? {
        guard let model = model, isAvailable else {
            return nil // Fallback to rule-based
        }
        
        // Apply adaptive multipliers to metrics (on-device learning)
        let adjustedMetrics = applyAdaptiveThresholds(to: metrics)
        
        do {
            let input = try createModelInput(from: adjustedMetrics)
            let prediction = try model.prediction(from: input)
            
            // Convert prediction to FormRecommendation
            return mapPredictionToRecommendation(prediction, metrics: metrics)
            
        } catch {
            print("[CoreMLCoach] Prediction error: \(error)")
            return nil // Fallback to rule-based
        }
    }
    
    /// Apply adaptive thresholds to metrics (simulates on-device learning)
    private func applyAdaptiveThresholds(to metrics: FormMetrics) -> FormMetrics {
        var adjusted = metrics
        
        // Adjust metrics based on learned multipliers
        // This simulates the model "learning" by adjusting its sensitivity
        if let cad = adjusted.cadence {
            // Lower multiplier = model becomes less sensitive (raises threshold)
            // Higher multiplier = model becomes more sensitive (lowers threshold)
            adjusted.cadence = cad * adaptiveThresholds.cadenceMultiplier
        }
        
        if let osc = adjusted.verticalOscillation {
            adjusted.verticalOscillation = osc * adaptiveThresholds.oscillationMultiplier
        }
        
        if let gct = adjusted.groundContactTime {
            adjusted.groundContactTime = gct * adaptiveThresholds.gctMultiplier
        }
        
        if let stride = adjusted.strideLength {
            adjusted.strideLength = stride * adaptiveThresholds.strideMultiplier
        }
        
        return adjusted
    }
    
    /// Create ML model input from FormMetrics
    private func createModelInput(from metrics: FormMetrics) throws -> MLFeatureProvider {
        var featureDict: [String: MLFeatureValue] = [:]
        
        featureDict["cadence"] = MLFeatureValue(double: metrics.cadence ?? 0)
        featureDict["vertical_oscillation"] = MLFeatureValue(double: metrics.verticalOscillation ?? 0)
        featureDict["ground_contact_time"] = MLFeatureValue(double: metrics.groundContactTime ?? 0)
        featureDict["stride_length"] = MLFeatureValue(double: metrics.strideLength ?? 0)
        featureDict["heart_rate"] = MLFeatureValue(double: metrics.heartRate ?? 0)
        featureDict["pace"] = MLFeatureValue(double: metrics.pace ?? 0)
        
        return try MLDictionaryFeatureProvider(dictionary: featureDict)
    }
    
    /// Map Core ML prediction output to FormRecommendation
    private func mapPredictionToRecommendation(_ prediction: MLFeatureProvider, metrics: FormMetrics) -> FormRecommendation? {
        // Core ML classifiers typically output:
        // - A dictionary of class probabilities (e.g., "increase_cadence": 0.85, "good_form": 0.15)
        // - Or a single "classLabel" string with the predicted class
        
        // Try to get class probabilities first (most common output format)
        if let classProbs = prediction.featureValue(for: "classProbability")?.dictionaryValue {
            // Find the class with highest probability
            var bestClass: String?
            var bestConfidence: Double = 0.0
            
            for (key, value) in classProbs {
                if let prob = value.doubleValue, prob > bestConfidence {
                    bestConfidence = prob
                    bestClass = key
                }
            }
            
            guard let recommendationType = bestClass,
                  bestConfidence >= adaptiveThresholds.confidenceThreshold else {
                return nil // Low confidence - fallback to rule-based
            }
            
            // Map to FormRecommendation
            let (message, detail, type) = mapRecommendationType(recommendationType, metrics: metrics)
            
            return FormRecommendation(
                message: message,
                detail: detail,
                type: type,
                timestamp: Date()
            )
        }
        
        // Fallback: Try direct classLabel output (some models output this)
        if let classLabel = prediction.featureValue(for: "classLabel")?.stringValue {
            // For classLabel, we assume high confidence (model is certain)
            let (message, detail, type) = mapRecommendationType(classLabel, metrics: metrics)
            
            return FormRecommendation(
                message: message,
                detail: detail,
                type: type,
                timestamp: Date()
            )
        }
        
        // If model has custom output schema, try recommendation_type and confidence
        if let recommendationType = prediction.featureValue(for: "recommendation_type")?.stringValue,
           let confidence = prediction.featureValue(for: "confidence")?.doubleValue {
            
            guard confidence >= adaptiveThresholds.confidenceThreshold else {
                return nil
            }
            
            let (message, detail, type) = mapRecommendationType(recommendationType, metrics: metrics)
            
            return FormRecommendation(
                message: message,
                detail: detail,
                type: type,
                timestamp: Date()
            )
        }
        
        // Unknown output format
        return nil
    }
    
    /// Map model output recommendation type to UI format
    private func mapRecommendationType(_ type: String, metrics: FormMetrics) -> (String, String, RecommendationType) {
        switch type.lowercased() {
        case "increase_cadence":
            return ("Increase Cadence", "Aim for 170-180 spm", .warning)
        case "run_flatter":
            let osc = Int(metrics.verticalOscillation ?? 0)
            return ("Run Flatter", "Reduce bounce (\(osc)cm)", .warning)
        case "light_feet":
            let gct = Int(metrics.groundContactTime ?? 0)
            return ("Light Feet", "Quicker turnover (\(gct)ms)", .warning)
        case "overstriding":
            return ("Overstriding", "Land under hips", .alert)
        case "good_form":
            return ("Great Form!", "Maintain efficiency", .good)
        default:
            return ("Form Check", "Review your running form", .warning)
        }
    }
}

