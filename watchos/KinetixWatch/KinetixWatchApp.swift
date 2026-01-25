import SwiftUI
import SwiftData

@main
struct KinetixWatchApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: [Run.self, ActivityTemplate.self, FormMonitorSample.self, CustomBatteryProfile.self])
    }
}
