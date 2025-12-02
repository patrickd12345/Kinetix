import Foundation
import SwiftData

/// Manages run state: start, pause, resume, stop, recovery
class RunStateManager: ObservableObject {
    @Published var isRunning: Bool = false
    @Published var isPaused: Bool = false
    
    private var _runStartTime: Date?
    private var pauseStartTime: Date?
    private var totalPausedDuration: TimeInterval = 0
    
    var runStartTime: Date? {
        get { _runStartTime }
        set { _runStartTime = newValue }
    }
    
    // Recovery
    private let userDefaults = UserDefaults.standard
    private let recoveryKey = "KinetixRunRecovery"
    
    // MARK: - Run Lifecycle
    
    func start() {
        isRunning = true
        isPaused = false
        runStartTime = Date()
        totalPausedDuration = 0
        pauseStartTime = nil
    }
    
    func pause() {
        guard isRunning, !isPaused else { return }
        isPaused = true
        pauseStartTime = Date()
    }
    
    func resume() {
        guard isRunning, isPaused else { return }
        isPaused = false
        
        if let pauseStart = pauseStartTime {
            totalPausedDuration += Date().timeIntervalSince(pauseStart)
            pauseStartTime = nil
        }
    }
    
    func stop() {
        isRunning = false
        isPaused = false
        runStartTime = nil
        pauseStartTime = nil
        totalPausedDuration = 0
    }
    
    // MARK: - Duration Calculation
    
    func elapsedDuration() -> TimeInterval {
        guard let startTime = runStartTime else { return 0 }
        
        let baseDuration = Date().timeIntervalSince(startTime)
        
        // Subtract paused time
        var currentPauseDuration: TimeInterval = 0
        if isPaused, let pauseStart = pauseStartTime {
            currentPauseDuration = Date().timeIntervalSince(pauseStart)
        }
        
        return baseDuration - totalPausedDuration - currentPauseDuration
    }
    
    // MARK: - Recovery
    
    func saveRecoveryData(_ data: RunRecoveryData) {
        if let encoded = try? JSONEncoder().encode(data) {
            userDefaults.set(encoded, forKey: recoveryKey)
        }
    }
    
    func checkForRecovery() -> RunRecoveryData? {
        guard let data = userDefaults.data(forKey: recoveryKey),
              let recovery = try? JSONDecoder().decode(RunRecoveryData.self, from: data) else {
            return nil
        }
        
        // Auto-discard if older than 1 hour
        let age = Date().timeIntervalSince(recovery.startTime)
        if age > 3600 {
            clearRecovery()
            return nil
        }
        
        return recovery
    }
    
    func clearRecovery() {
        userDefaults.removeObject(forKey: recoveryKey)
    }
    
    func recoverRun(_ recovery: RunRecoveryData) {
        // Restore run state from recovery data
        _runStartTime = recovery.startTime
        totalPausedDuration = 0
        isRunning = true
        isPaused = false
        clearRecovery()
    }
}

