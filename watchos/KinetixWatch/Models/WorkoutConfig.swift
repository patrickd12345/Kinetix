import Foundation
import SwiftData
import SwiftUI

// MARK: - BATTERY PROFILES

public enum BatteryProfileType: String, Codable, CaseIterable, Identifiable {
    case aggressive
    case balanced
    case eco
    case emergency
    
    public var id: String { rawValue }
    
    var description: String {
        switch self {
        case .aggressive: return "Max Precision (Full GPS, Haptics, Voice)"
        case .balanced: return "Standard (Optimized GPS, Voice)"
        case .eco: return "Long Run (Reduced GPS, Haptics Only)"
        case .emergency: return "Survival (Min Sampling, Silent)"
        }
    }
}

public struct BatterySettings: Codable {
    let profile: BatteryProfileType?
    let customProfileId: String? // ID of custom profile if using custom
    
    // Sampling Intervals (seconds)
    let gpsInterval: Double
    let motionSensorInterval: Double
    let formAnalysisInterval: Double
    let saveInterval: Double
    
    // Features
    let allowHaptics: Bool
    let allowVoice: Bool
    let allowLiveCharts: Bool
    
    // Initializer for built-in profiles
    init(profile: BatteryProfileType, gpsInterval: Double, motionSensorInterval: Double, formAnalysisInterval: Double, saveInterval: Double, allowHaptics: Bool, allowVoice: Bool, allowLiveCharts: Bool) {
        self.profile = profile
        self.customProfileId = nil
        self.gpsInterval = gpsInterval
        self.motionSensorInterval = motionSensorInterval
        self.formAnalysisInterval = formAnalysisInterval
        self.saveInterval = saveInterval
        self.allowHaptics = allowHaptics
        self.allowVoice = allowVoice
        self.allowLiveCharts = allowLiveCharts
    }
    
    // Initializer for custom profiles
    init(customProfileId: String, gpsInterval: Double, motionSensorInterval: Double, formAnalysisInterval: Double, saveInterval: Double, allowHaptics: Bool, allowVoice: Bool, allowLiveCharts: Bool) {
        self.profile = nil
        self.customProfileId = customProfileId
        self.gpsInterval = gpsInterval
        self.motionSensorInterval = motionSensorInterval
        self.formAnalysisInterval = formAnalysisInterval
        self.saveInterval = saveInterval
        self.allowHaptics = allowHaptics
        self.allowVoice = allowVoice
        self.allowLiveCharts = allowLiveCharts
    }
    
    static func settings(for profile: BatteryProfileType) -> BatterySettings {
        switch profile {
        case .aggressive:
            return BatterySettings(profile: .aggressive, gpsInterval: 1.0, motionSensorInterval: 1.0, formAnalysisInterval: 5.0, saveInterval: 30.0, allowHaptics: true, allowVoice: true, allowLiveCharts: true)
        case .balanced:
            return BatterySettings(profile: .balanced, gpsInterval: 2.0, motionSensorInterval: 2.0, formAnalysisInterval: 15.0, saveInterval: 60.0, allowHaptics: true, allowVoice: true, allowLiveCharts: true)
        case .eco:
            return BatterySettings(profile: .eco, gpsInterval: 5.0, motionSensorInterval: 5.0, formAnalysisInterval: 30.0, saveInterval: 120.0, allowHaptics: true, allowVoice: false, allowLiveCharts: false)
        case .emergency:
            return BatterySettings(profile: .emergency, gpsInterval: 10.0, motionSensorInterval: 10.0, formAnalysisInterval: 60.0, saveInterval: 300.0, allowHaptics: false, allowVoice: false, allowLiveCharts: false)
        }
    }
}

// MARK: - WORKOUT PRESETS

public enum PresetType: String, Codable, CaseIterable, Identifiable {
    case meBeatMe = "MeBeatMe"
    case race = "Race Mode"
    case burner = "Burner"
    case formMonitor = "Form Monitor"
    case custom = "Custom"
    
    public var id: String { rawValue }
}

@Model
final class WorkoutPreset {
    @Attribute(.unique) var id: String
    var name: String
    var type: PresetType
    var targetNPI: Double
    var defaultBatteryProfile: BatteryProfileType
    var metricsToShow: [String] // e.g., ["pace", "hr", "cadence"]
    var audioCuesEnabled: Bool
    var lastModified: Date
    
    init(id: String = UUID().uuidString, name: String, type: PresetType, targetNPI: Double, batteryProfile: BatteryProfileType = .balanced, metrics: [String] = ["pace", "hr", "dist"], audio: Bool = true) {
        self.id = id
        self.name = name
        self.type = type
        self.targetNPI = targetNPI
        self.defaultBatteryProfile = batteryProfile
        self.metricsToShow = metrics
        self.audioCuesEnabled = audio
        self.lastModified = Date()
    }
    
    static func builtInPresets() -> [WorkoutPreset] {
        return [
            WorkoutPreset(id: "preset_mebeatme", name: "MeBeatMe", type: .meBeatMe, targetNPI: 135, batteryProfile: .aggressive, metrics: ["npi", "pace", "projected_time"], audio: true),
            WorkoutPreset(id: "preset_race", name: "Race Mode", type: .race, targetNPI: 150, batteryProfile: .balanced, metrics: ["pace", "dist", "time"], audio: true),
            WorkoutPreset(id: "preset_burner", name: "Burner", type: .burner, targetNPI: 120, batteryProfile: .eco, metrics: ["hr", "cal", "time"], audio: false),
            WorkoutPreset(id: "preset_form_monitor", name: "Form Monitor", type: .formMonitor, targetNPI: 0, batteryProfile: .balanced, metrics: ["form", "symmetry", "instability"], audio: true)
        ]
    }
}




