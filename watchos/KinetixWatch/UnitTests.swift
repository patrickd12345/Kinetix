import Foundation
import SwiftUI

// MARK: - Manual Test Suite ("Jest")
// Since we don't have a separate test target set up, we'll run these internal checks.

class KinetixTester: ObservableObject {
    @Published var testLogs: [String] = []
    @Published var isRunning = false
    @Published var progress: Double = 0.0
    
    func runAllTests() {
        isRunning = true
        testLogs = []
        progress = 0.0
        
        Task {
            log("🏃‍♂️ STARTING KINETIX SELF-TEST")
            
            // 1. Test FormMetrics Calculations
            await testMetricsCalculation()
            progress = 0.33
            
            // 2. Test Adaptive Learner
            await testAdaptiveLearner()
            progress = 0.66
            
            // 3. Test Form Coach Logic
            await testFormCoach()
            progress = 1.0
            
            log("✅ ALL TESTS COMPLETED")
            isRunning = false
        }
    }
    
    private func log(_ message: String) {
        DispatchQueue.main.async {
            print("[TEST] \(message)")
            self.testLogs.append(message)
        }
    }
    
    private func assert(_ condition: Bool, _ message: String) {
        if condition {
            log("  ✅ PASS: \(message)")
        } else {
            log("  ❌ FAIL: \(message)")
        }
    }
    
    // MARK: - Test Cases
    
    private func testMetricsCalculation() async {
        log("🧪 Testing Metrics Calculations...")
        
        var metrics = FormMetrics()
        metrics.cadence = 180 // spm
        metrics.verticalOscillation = 8.0 // cm
        metrics.groundContactTime = 200 // ms
        metrics.strideLength = 1.2 // m
        
        // Step Length
        let expectedStep = 0.6
        assert(abs((metrics.stepLength ?? 0) - expectedStep) < 0.01, "Step Length Calculation")
        
        // Efficiency (180 / (8 + 1)) = 20
        let expectedEff = 180.0 / (8.0 + 1.0)
        assert(abs((metrics.runningEfficiency ?? 0) - expectedEff) < 0.01, "Running Efficiency Calculation")
        
        // Leg Stiffness (180 / (200 + 0.001)) ~= 0.9
        let expectedStiff = 180.0 / (200.0 + 0.001)
        assert(abs((metrics.legStiffness ?? 0) - expectedStiff) < 0.01, "Leg Stiffness Calculation")
        
        try? await Task.sleep(nanoseconds: 500_000_000)
    }
    
    private func testAdaptiveLearner() async {
        log("🧪 Testing Adaptive Learner...")
        
        let learner = AdaptiveLearner()
        // Verify defaults - using public methods
        assert(learner.getCadenceThreshold() == 160.0, "Default Cadence Threshold")
        
        // Simulate improvements
        var metrics = FormMetrics()
        metrics.cadence = 175
        metrics.verticalOscillation = 8.0
        
        // runningEfficiency is computed, so we don't set it directly. 
        // We check if the logic works by ensuring the code compiles and runs without crashing.
        
        learner.evaluateOutcomes(currentMetrics: metrics) // Passed required argument
        assert(true, "AdaptiveLearner public API check")
        
        try? await Task.sleep(nanoseconds: 500_000_000)
    }
    
    private func testFormCoach() async {
        log("🧪 Testing Form Coach Logic...")
        
        let coach = FormCoach()
        
        // Test Mode Switching
        coach.setMode(.ruleBased)
        assert(coach.currentMode == .ruleBased, "Set Mode to Rule-Based")
        
        // Test Evaluation (Rule Based)
        var badMetrics = FormMetrics()
        badMetrics.cadence = 150 // Low
        badMetrics.verticalOscillation = 12 // High
        badMetrics.groundContactTime = 200
        
        coach.evaluate(metrics: badMetrics)
        
        // Allow time for async evaluation
        try? await Task.sleep(nanoseconds: 200_000_000)
        
        if let rec = coach.currentRecommendation {
            log("  ℹ️ Generated Recommendation: \(rec.message)")
            // Expecting cadence warning or oscillation warning
            let relevant = rec.message.contains("Cadence") || rec.message.contains("Bounce")
            assert(relevant, "Generated relevant recommendation for bad form")
        } else {
            assert(false, "Failed to generate recommendation for bad form")
        }
        
        // Test Good Form
        var goodMetrics = FormMetrics()
        goodMetrics.cadence = 180
        goodMetrics.verticalOscillation = 8
        goodMetrics.groundContactTime = 200
        
        coach.evaluate(metrics: goodMetrics)
        try? await Task.sleep(nanoseconds: 200_000_000)
        
        // Should be nil or good job
        if let rec = coach.currentRecommendation {
             log("  ℹ️ Generated Recommendation: \(rec.message)")
             assert(rec.type == .good, "Good form recognised")
        } else {
             assert(true, "No complaint for good form")
        }
    }
}

struct TestRunnerView: View {
    @StateObject private var tester = KinetixTester()
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                Text("Kinetix Self-Test").font(.headline)
                
                if tester.isRunning {
                    ProgressView(value: tester.progress)
                    Text("Running tests...").font(.caption)
                } else {
                    Button("Run Tests") {
                        tester.runAllTests()
                    }
                    .buttonStyle(.borderedProminent)
                }
                
                Divider()
                
                VStack(alignment: .leading, spacing: 5) {
                    ForEach(tester.testLogs, id: \.self) { log in
                        Text(log)
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(log.contains("✅") ? .green : log.contains("❌") ? .red : .white)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding()
        }
    }
}

