import Foundation
import WatchKit

class BatteryManager: ObservableObject {
    @Published var currentLevel: Float = 1.0
    @Published var currentState: WKInterfaceDeviceBatteryState = .unknown
    @Published var activeProfile: BatteryProfileType = .balanced
    @Published var activeSettings: BatterySettings = BatterySettings.settings(for: .balanced)
    
    // Auto-switch thresholds
    var autoSwitchEnabled: Bool = true
    private var lastSwitchLevel: Float = 1.0
    
    init() {
        WKInterfaceDevice.current().isBatteryMonitoringEnabled = true
        updateBatteryStatus()
        
        // Monitor periodically
        Timer.scheduledTimer(withTimeInterval: 60.0, repeats: true) { _ in
            self.updateBatteryStatus()
        }
    }
    
    func setProfile(_ profile: BatteryProfileType) {
        self.activeProfile = profile
        self.activeSettings = BatterySettings.settings(for: profile)
        print("[Battery] Switched to \(profile.rawValue)")
    }
    
    private func updateBatteryStatus() {
        let device = WKInterfaceDevice.current()
        self.currentLevel = device.batteryLevel
        self.currentState = device.batteryState
        
        checkAutoSwitch()
    }
    
    private func checkAutoSwitch() {
        guard autoSwitchEnabled else { return }
        
        // Thresholds: 40% -> Balanced, 20% -> Eco, 10% -> Emergency
        // Only downgrade, never auto-upgrade during run
        
        if currentLevel <= 0.10 && activeProfile != .emergency {
            setProfile(.emergency)
        } else if currentLevel <= 0.20 && activeProfile != .eco && activeProfile != .emergency {
            setProfile(.eco)
        } else if currentLevel <= 0.40 && activeProfile == .aggressive {
            setProfile(.balanced)
        }
    }
}

