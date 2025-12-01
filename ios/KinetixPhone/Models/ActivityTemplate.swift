import Foundation
import SwiftData

public enum ActivityGoalType: String, Codable, CaseIterable, Identifiable {
    case efficiency
    case race
    case burner
    case formMonitor
    case freeRun
    
    public var id: String { rawValue }
    
    var displayName: String {
        switch self {
        case .efficiency: return "Efficiency / NPI"
        case .race: return "Race"
        case .burner: return "Burner"
        case .formMonitor: return "Form Monitor"
        case .freeRun: return "Free Run"
        }
    }
}

public enum ActivityScreenType: String, Codable, CaseIterable, Identifiable {
    case bubble
    case metrics
    case pace
    case npi
    case map
    case coach
    case history
    
    public var id: String { rawValue }
    
    var label: String {
        switch self {
        case .bubble: return "Form Bubble"
        case .metrics: return "Metrics Grid"
        case .pace: return "Pace"
        case .npi: return "NPI"
        case .map: return "Route"
        case .coach: return "Coach"
        case .history: return "History"
        }
    }
}

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

public struct FeedbackSettings: Codable, Equatable {
    public var hapticsEnabled: Bool
    public var speechEnabled: Bool
    public var bubbleSensitivity: Double
    public var symmetryHaptics: Bool
    public var sonicEnabled: Bool
    public var sonicSensitivity: Double
    
    public init(
        hapticsEnabled: Bool = true,
        speechEnabled: Bool = true,
        bubbleSensitivity: Double = 1.0,
        symmetryHaptics: Bool = true,
        sonicEnabled: Bool = true,
        sonicSensitivity: Double = 1.0
    ) {
        self.hapticsEnabled = hapticsEnabled
        self.speechEnabled = speechEnabled
        self.bubbleSensitivity = bubbleSensitivity
        self.symmetryHaptics = symmetryHaptics
        self.sonicEnabled = sonicEnabled
        self.sonicSensitivity = sonicSensitivity
    }
}

public struct ActivityPayload: Codable, Identifiable {
    public var id: String
    public var name: String
    public var icon: String
    public var primaryScreen: ActivityScreenType
    public var secondaryScreens: [ActivityScreenType]
    public var feedback: FeedbackSettings
    public var goal: ActivityGoalType
    public var defaultBatteryProfile: BatteryProfileType
    public var lastModified: Date
    public var isCustom: Bool
}

@Model
final class ActivityTemplate {
    @Attribute(.unique) var id: String
    var name: String
    var icon: String
    private var primaryScreenRaw: String
    private var secondaryScreensRaw: [String]
    @Attribute(.transformable) var feedback: FeedbackSettings
    private var goalRaw: String
    private var batteryProfileRaw: String
    var lastModified: Date
    var isCustom: Bool
    
    init(
        id: String = UUID().uuidString,
        name: String,
        icon: String,
        primaryScreen: ActivityScreenType,
        secondaryScreens: [ActivityScreenType],
        feedback: FeedbackSettings = FeedbackSettings(),
        goal: ActivityGoalType,
        defaultBatteryProfile: BatteryProfileType = .balanced,
        lastModified: Date = .now,
        isCustom: Bool = true
    ) {
        self.id = id
        self.name = name
        self.icon = icon
        self.primaryScreenRaw = primaryScreen.rawValue
        self.secondaryScreensRaw = secondaryScreens.map { $0.rawValue }
        self.feedback = feedback
        self.goalRaw = goal.rawValue
        self.batteryProfileRaw = defaultBatteryProfile.rawValue
        self.lastModified = lastModified
        self.isCustom = isCustom
    }
    
    var primaryScreen: ActivityScreenType {
        get { ActivityScreenType(rawValue: primaryScreenRaw) ?? .bubble }
        set { primaryScreenRaw = newValue.rawValue }
    }
    
    var secondaryScreens: [ActivityScreenType] {
        get { secondaryScreensRaw.compactMap(ActivityScreenType.init(rawValue:)) }
        set { secondaryScreensRaw = newValue.map { $0.rawValue } }
    }
    
    var goal: ActivityGoalType {
        get { ActivityGoalType(rawValue: goalRaw) ?? .efficiency }
        set { goalRaw = newValue.rawValue }
    }
    
    var defaultBatteryProfile: BatteryProfileType {
        get { BatteryProfileType(rawValue: batteryProfileRaw) ?? .balanced }
        set { batteryProfileRaw = newValue.rawValue }
    }
    
    func toPayload() -> ActivityPayload {
        ActivityPayload(
            id: id,
            name: name,
            icon: icon,
            primaryScreen: primaryScreen,
            secondaryScreens: secondaryScreens,
            feedback: feedback,
            goal: goal,
            defaultBatteryProfile: defaultBatteryProfile,
            lastModified: lastModified,
            isCustom: isCustom
        )
    }
}
