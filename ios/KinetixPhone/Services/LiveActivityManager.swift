import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif

#if canImport(ActivityKit)
@available(iOS 16.1, *)
struct KinetixAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var kps: Double
        var distance: Double
        var pace: String
        var elapsedTime: String
    }

    var runName: String
}

@available(iOS 16.1, *)
class LiveActivityManager {
    static let shared = LiveActivityManager()
    private var currentActivity: Activity<KinetixAttributes>?

    func startRunActivity(name: String, kps: Double, distance: Double, pace: String, time: String) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let attributes = KinetixAttributes(runName: name)
        let state = KinetixAttributes.ContentState(kps: kps, distance: distance, pace: pace, elapsedTime: time)

        do {
            if #available(iOS 16.2, *) {
                let content = ActivityContent(state: state, staleDate: nil)
                currentActivity = try Activity.request(attributes: attributes, content: content, pushType: nil)
            } else {
                currentActivity = try Activity.request(attributes: attributes, contentState: state, pushType: nil)
            }
            print("🚀 Started Live Activity")
        } catch {
            print("❌ Error starting Live Activity: \(error.localizedDescription)")
        }
    }

    func updateRunActivity(kps: Double, distance: Double, pace: String, time: String) {
        Task {
            let state = KinetixAttributes.ContentState(kps: kps, distance: distance, pace: pace, elapsedTime: time)
            if #available(iOS 16.2, *) {
                let content = ActivityContent(state: state, staleDate: nil)
                await currentActivity?.update(content)
            } else {
                await currentActivity?.update(using: state)
            }
        }
    }

    func stopRunActivity() {
        Task {
            if #available(iOS 16.2, *) {
                await currentActivity?.end(nil, dismissalPolicy: .immediate)
            } else {
                await currentActivity?.end(dismissalPolicy: .immediate)
            }
            currentActivity = nil
            print("🛑 Ended Live Activity")
        }
    }
}
#else
// Fallbacks for platforms/OS versions where ActivityKit is unavailable
struct LiveActivityManager {
    static let shared = LiveActivityManager()
    func startRunActivity(name: String, kps: Double, distance: Double, pace: String, time: String) { /* no-op */ }
    func updateRunActivity(kps: Double, distance: Double, pace: String, time: String) { /* no-op */ }
    func stopRunActivity() { /* no-op */ }
}
#endif
