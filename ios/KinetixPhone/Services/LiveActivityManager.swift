import Foundation
import ActivityKit

struct KinetixAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var kps: Double
        var distance: Double
        var pace: String
        var elapsedTime: String
    }

    var runName: String
}

class LiveActivityManager {
    static let shared = LiveActivityManager()
    private var currentActivity: Activity<KinetixAttributes>?

    func startRunActivity(name: String, kps: Double, distance: Double, pace: String, time: String) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let attributes = KinetixAttributes(runName: name)
        let state = KinetixAttributes.ContentState(kps: kps, distance: distance, pace: pace, elapsedTime: time)

        do {
            currentActivity = try Activity.request(attributes: attributes, contentState: state, pushType: nil)
            print("🚀 Started Live Activity")
        } catch {
            print("❌ Error starting Live Activity: \(error.localizedDescription)")
        }
    }

    func updateRunActivity(kps: Double, distance: Double, pace: String, time: String) {
        Task {
            let state = KinetixAttributes.ContentState(kps: kps, distance: distance, pace: pace, elapsedTime: time)
            await currentActivity?.update(using: state)
        }
    }

    func stopRunActivity() {
        Task {
            await currentActivity?.end(dismissalPolicy: .immediate)
            currentActivity = nil
            print("🛑 Ended Live Activity")
        }
    }
}
