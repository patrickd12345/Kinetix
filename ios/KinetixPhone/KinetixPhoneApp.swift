import SwiftUI
import SwiftData

@main
struct KinetixPhoneApp: App {
    var body: some Scene {
        WindowGroup {
            MainTabView()
        }
        .modelContainer(for: [Run.self, ActivityTemplate.self, FormMonitorSample.self, RunnerProfile.self, DiagnosticLogEntry.self])
    }
}
