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
        case .efficiency: return "Efficiency / KPS"
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
        case .npi: return "KPS"
        case .map: return "Route"
        case .coach: return "Coach"
        case .history: return "History"
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
    
    init(template: ActivityTemplate) {
        self.id = template.id
        self.name = template.name
        self.icon = template.icon
        self.primaryScreen = template.primaryScreen
        self.secondaryScreens = template.secondaryScreens
        self.feedback = template.feedback
        self.goal = template.goal
        self.defaultBatteryProfile = template.defaultBatteryProfile
        self.lastModified = template.lastModified
        self.isCustom = template.isCustom
    }
}

@Model
final class ActivityTemplate {
    @Attribute(.unique) var id: String
    var name: String
    var icon: String
    private var primaryScreenRaw: String
    private var secondaryScreensRaw: [String]
    private var feedbackJSON: String
    private var goalRaw: String
    private var batteryProfileRaw: String
    var lastModified: Date
    var isCustom: Bool
    
    var feedback: FeedbackSettings {
        get {
            guard let data = feedbackJSON.data(using: .utf8),
                  let decoded = try? JSONDecoder().decode(FeedbackSettings.self, from: data) else {
                return FeedbackSettings()
            }
            return decoded
        }
        set {
            if let encoded = try? JSONEncoder().encode(newValue),
               let jsonString = String(data: encoded, encoding: .utf8) {
                feedbackJSON = jsonString
            }
        }
    }
    
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
        if let encoded = try? JSONEncoder().encode(feedback),
           let jsonString = String(data: encoded, encoding: .utf8) {
            self.feedbackJSON = jsonString
        } else {
            self.feedbackJSON = "{}"
        }
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
        ActivityPayload(template: self)
    }
}
