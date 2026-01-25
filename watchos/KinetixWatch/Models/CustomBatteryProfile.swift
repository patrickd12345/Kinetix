import Foundation
import SwiftData

// Payload for syncing custom profiles to Watch
public struct BatteryProfilePayload: Codable, Identifiable {
    public let id: String
    public let name: String
    public let gpsInterval: Double
    public let motionSensorInterval: Double
    public let formAnalysisInterval: Double
    public let saveInterval: Double
    public let allowHaptics: Bool
    public let allowVoice: Bool
    public let allowLiveCharts: Bool
    public let lastModified: Date
    public let isCustom: Bool
    
    public init(id: String, name: String, gpsInterval: Double, motionSensorInterval: Double, formAnalysisInterval: Double, saveInterval: Double, allowHaptics: Bool, allowVoice: Bool, allowLiveCharts: Bool, lastModified: Date, isCustom: Bool) {
        self.id = id
        self.name = name
        self.gpsInterval = gpsInterval
        self.motionSensorInterval = motionSensorInterval
        self.formAnalysisInterval = formAnalysisInterval
        self.saveInterval = saveInterval
        self.allowHaptics = allowHaptics
        self.allowVoice = allowVoice
        self.allowLiveCharts = allowLiveCharts
        self.lastModified = lastModified
        self.isCustom = isCustom
    }
}

// SwiftData model for custom battery profiles
@Model
final class CustomBatteryProfile {
    @Attribute(.unique) var id: String
    var name: String
    var gpsInterval: Double
    var motionSensorInterval: Double
    var formAnalysisInterval: Double
    var saveInterval: Double
    var allowHaptics: Bool
    var allowVoice: Bool
    var allowLiveCharts: Bool
    var lastModified: Date
    var isCustom: Bool
    
    init(id: String = UUID().uuidString, name: String, gpsInterval: Double, motionSensorInterval: Double, formAnalysisInterval: Double, saveInterval: Double, allowHaptics: Bool, allowVoice: Bool, allowLiveCharts: Bool, isCustom: Bool = true) {
        self.id = id
        self.name = name
        self.gpsInterval = gpsInterval
        self.motionSensorInterval = motionSensorInterval
        self.formAnalysisInterval = formAnalysisInterval
        self.saveInterval = saveInterval
        self.allowHaptics = allowHaptics
        self.allowVoice = allowVoice
        self.allowLiveCharts = allowLiveCharts
        self.lastModified = Date()
        self.isCustom = isCustom
    }
    
    func toPayload() -> BatteryProfilePayload {
        BatteryProfilePayload(
            id: id,
            name: name,
            gpsInterval: gpsInterval,
            motionSensorInterval: motionSensorInterval,
            formAnalysisInterval: formAnalysisInterval,
            saveInterval: saveInterval,
            allowHaptics: allowHaptics,
            allowVoice: allowVoice,
            allowLiveCharts: allowLiveCharts,
            lastModified: lastModified,
            isCustom: isCustom
        )
    }
    
    func toBatterySettings() -> BatterySettings {
        return BatterySettings(
            customProfileId: id,
            gpsInterval: gpsInterval,
            motionSensorInterval: motionSensorInterval,
            formAnalysisInterval: formAnalysisInterval,
            saveInterval: saveInterval,
            allowHaptics: allowHaptics,
            allowVoice: allowVoice,
            allowLiveCharts: allowLiveCharts
        )
    }
}

