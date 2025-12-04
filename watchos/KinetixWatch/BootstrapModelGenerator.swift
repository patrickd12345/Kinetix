import Foundation

/// Generates a bootstrap Core ML model from rule-based logic
/// This creates a simple model that mimics the rule-based system
/// and can be included in the app from the start
class BootstrapModelGenerator {
    
    /// Generate training data from rule-based logic
    static func generateTrainingData(count: Int = 10000) -> String {
        var csv = "cadence,vertical_oscillation,ground_contact_time,stride_length,heart_rate,pace,recommendation_type,confidence\n"
        
        for _ in 0..<count {
            let cadence = Double.random(in: 140...200)
            let verticalOsc = Double.random(in: 5...15)
            let gct = Double.random(in: 200...350)
            let stride = Double.random(in: 0.8...1.5)
            let hr = Double.random(in: 120...180)
            let pace = Double.random(in: 180...600) // 3:00 to 10:00 per km
            
            // Apply rule-based logic to generate labels
            var recommendation = "good_form"
            var confidence = 0.7
            
            // Priority-based (same as rule-based system)
            if stride > 1.3 && cadence < 160 {
                let stepLen = stride / 2.0
                if stepLen > 0.7 {
                    recommendation = "overstriding"
                    confidence = 0.9
                }
            } else if cadence < 160 {
                recommendation = "increase_cadence"
                confidence = 0.85
            } else if verticalOsc > 12.0 {
                recommendation = "run_flatter"
                confidence = 0.8
            } else if gct > 300 {
                recommendation = "light_feet"
                confidence = 0.75
            } else {
                // Good form - lower confidence for variety
                confidence = Double.random(in: 0.6...0.8)
            }
            
            csv += String(format: "%.2f,%.2f,%.2f,%.2f,%.2f,%.2f,%@,%.2f\n",
                         cadence, verticalOsc, gct, stride, hr, pace, recommendation, confidence)
        }
        
        return csv
    }
}









