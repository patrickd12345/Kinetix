import Foundation
import SwiftData
import SwiftUI
#if os(watchOS)
import WatchKit
#endif

struct FormBubbleState: Equatable {
    var normalized: CGPoint = .zero
    var size: CGFloat = 24
    var symmetry: Double = 1.0 // 0-1
    var instability: Double = 0.0 // 0-1
    var color: Color = .green
    var rollingPace: Double?
}

final class FormMonitorEngine: ObservableObject {
    @Published var state = FormBubbleState()
    
    private struct TimedMetrics {
        let date: Date
        let metrics: FormMetrics
        let pace: Double
    }
    
    private var window: [TimedMetrics] = []
    private var lastHaptic: String?
    private var lastHapticTime: Date = .distantPast
    private var lastSampleTime: Date = .distantPast
    private var sonicEnabled = false
    private let sonicEngine = SonicFormEngine()
    
    private weak var modelContext: ModelContext?
    private var sessionId: UUID?
    private var feedback: FeedbackSettings = FeedbackSettings()
    
    func bind(context: ModelContext?) {
        self.modelContext = context
    }
    
    func start(sessionId: UUID, feedback: FeedbackSettings) {
        self.sessionId = sessionId
        self.feedback = feedback
        sonicEnabled = feedback.sonicEnabled
        window.removeAll()
        lastSampleTime = .distantPast
        if sonicEnabled {
            sonicEngine.start(sensitivity: feedback.sonicSensitivity)
        }
    }
    
    func endSession() {
        sessionId = nil
        window.removeAll()
        sonicEngine.stop()
    }
    
    @discardableResult
    func ingest(metrics: FormMetrics, pace: Double, rollingPace: Double, balance: Double?, hapticsAllowed: Bool) -> FormBubbleState {
        let now = Date()
        window.append(TimedMetrics(date: now, metrics: metrics, pace: pace))
        window = window.filter { now.timeIntervalSince($0.date) <= 5.0 }
        
        // Averages for smoothing
        let avgCadence = average(\.cadence)
        let avgVO = average(\.verticalOscillation)
        let avgStride = average(\.strideLength)
        let avgGCT = average(\.groundContactTime)
        let avgBalance = balance ?? average(\.leftRightBalance) ?? 50
        
        let overstrideIndex = normalizedOverstride(cadence: avgCadence, stride: avgStride)
        let verticalDeviation = normalizedVerticalOscillation(vo: avgVO)
        let instability = calculateInstability(cadence: avgCadence, vo: avgVO, gct: avgGCT)
        let symmetryScore = calculateSymmetry(balance: avgBalance, gct: avgGCT)
        let bubbleSize = 24 + CGFloat(instability * 18)
        let color = Color(hue: 0.33 * symmetryScore, saturation: 0.85, brightness: 0.95)
        
        let smoothedX = smooth(current: state.normalized.x, target: overstrideIndex, factor: 0.22)
        let smoothedY = smooth(current: state.normalized.y, target: verticalDeviation, factor: 0.22)
        let smoothedSize = smooth(current: Double(state.size), target: Double(bubbleSize), factor: 0.22)
        let newState = FormBubbleState(
            normalized: CGPoint(x: smoothedX, y: smoothedY),
            size: CGFloat(smoothedSize),
            symmetry: symmetryScore,
            instability: instability,
            color: color,
            rollingPace: rollingPace
        )
        
        DispatchQueue.main.async {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.75, blendDuration: 0.2)) {
                self.state = newState
            }
        }
        
        if feedback.hapticsEnabled && hapticsAllowed {
            triggerHaptics(for: newState, cadence: avgCadence, vo: avgVO)
        }
        
        if sonicEnabled {
            sonicEngine.update(with: newState, metrics: metrics, sensitivity: feedback.sonicSensitivity)
        }
        
        logSampleIfNeeded(state: newState, metrics: metrics, pace: pace)
        return newState
    }
    
    private func average(_ keyPath: KeyPath<FormMetrics, Double?>) -> Double? {
        let values = window.compactMap { $0.metrics[keyPath: keyPath] }
        guard !values.isEmpty else { return nil }
        return values.reduce(0, +) / Double(values.count)
    }
    
    private func normalizedOverstride(cadence: Double?, stride: Double?) -> Double {
        let cad = cadence ?? 170
        let strideLen = stride ?? 1.1
        let cadenceScore = (cad - 170) / 35.0 // ~170-200 range
        let strideScore = (strideLen - 1.2) / 0.45 // bigger positive means overstride
        let mixed = strideScore - (cadenceScore * 0.4)
        return max(-1, min(1, mixed))
    }
    
    private func normalizedVerticalOscillation(vo: Double?) -> Double {
        let target: Double = 8.5
        let spread: Double = 5.0
        let osc = vo ?? target
        return max(-1, min(1, (osc - target) / spread))
    }
    
    private func calculateInstability(cadence: Double?, vo: Double?, gct: Double?) -> Double {
        let cadValues = window.compactMap { $0.metrics.cadence }
        let voValues = window.compactMap { $0.metrics.verticalOscillation }
        let gctValues = window.compactMap { $0.metrics.groundContactTime }
        
        let cadJitter = variability(for: cadValues, reference: cadence ?? 0)
        let voJitter = variability(for: voValues, reference: vo ?? 0)
        let gctJitter = variability(for: gctValues, reference: gct ?? 0)
        let composite = (cadJitter * 0.4) + (voJitter * 0.35) + (gctJitter * 0.25)
        return max(0, min(1, composite))
    }
    
    private func variability(for values: [Double], reference: Double) -> Double {
        guard values.count > 1, reference > 0 else { return 0 }
        let mean = values.reduce(0, +) / Double(values.count)
        let variance = values.reduce(0) { $0 + pow($1 - mean, 2) } / Double(values.count)
        let stdDev = sqrt(variance)
        return min(1, stdDev / max(1, reference * 0.1))
    }
    
    private func calculateSymmetry(balance: Double, gct: Double?) -> Double {
        let balanceScore = max(0, 1 - abs(balance - 50) / 30) // 50 perfect, 20/80 worst
        if let gct = gct {
            let gctScore = max(0, 1 - (gct - 220) / 200)
            return max(0, min(1, (balanceScore * 0.7) + (gctScore * 0.3)))
        }
        return balanceScore
    }
    
    private func triggerHaptics(for state: FormBubbleState, cadence: Double?, vo: Double?) {
        #if os(watchOS)
        let now = Date()
        let driftThreshold = 0.35 / max(0.6, feedback.bubbleSensitivity)
        let bounceThreshold = 0.4 / max(0.75, feedback.bubbleSensitivity)
        
        func playOnce(_ key: String, pattern: WKHapticType) {
            if lastHaptic != key || now.timeIntervalSince(lastHapticTime) > 2 {
                WKInterfaceDevice.current().play(pattern)
                lastHaptic = key
                lastHapticTime = now
            }
        }
        
        if feedback.symmetryHaptics && state.normalized.x > driftThreshold {
            playOnce("drift_right", pattern: .directionRight)
        } else if feedback.symmetryHaptics && state.normalized.x < -driftThreshold {
            playOnce("drift_left", pattern: .directionLeft)
        } else if state.normalized.y > bounceThreshold {
            playOnce("bounce", pattern: .retry)
        } else if state.normalized.y < -bounceThreshold {
            playOnce("deadened", pattern: .directionDown)
        } else if let cad = cadence, cad < 165 {
            playOnce("low_cadence", pattern: .click)
        }
        #endif
    }
    
    private func logSampleIfNeeded(state: FormBubbleState, metrics: FormMetrics, pace: Double) {
        guard let sessionId, let modelContext else { return }
        let now = Date()
        guard now.timeIntervalSince(lastSampleTime) >= 1.5 else { return }
        lastSampleTime = now
        
        let sample = FormMonitorSample(
            sessionId: sessionId,
            timestamp: now,
            bubbleX: state.normalized.x,
            bubbleY: state.normalized.y,
            instability: state.instability,
            symmetry: state.symmetry,
            cadence: metrics.cadence,
            verticalOscillation: metrics.verticalOscillation,
            strideLength: metrics.strideLength,
            groundContactTime: metrics.groundContactTime,
            pace: pace,
            leftRightBalance: metrics.leftRightBalance,
            rollingPace: state.rollingPace
        )
        modelContext.insert(sample)
    }
    
    private func smooth(current: Double, target: Double, factor: Double) -> Double {
        current + (target - current) * factor
    }
}
