import SwiftData
import SwiftUI

@main
struct KinetixPhoneApp: App {
    init() {
        KinetixSentry.configure()
    }

    var body: some Scene {
        WindowGroup {
            MainTabView()
        }
        .modelContainer(for: [
            Run.self,
            ActivityTemplate.self,
            FormMonitorSample.self,
            RunnerProfile.self,
            DiagnosticLogEntry.self,
            CustomBatteryProfile.self,
<<<<<<< HEAD
            WeightEntry.self
=======
            WeightEntry.self,
            HumanState.self,
            ReasoningLog.self
>>>>>>> origin/main
        ])
    }
}
