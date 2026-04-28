import SwiftUI
import SwiftData

struct MainTabView: View {
    @Environment(\.modelContext) private var modelContext
    @ObservedObject private var connectivity = ConnectivityManager.shared
    @State private var selectedTab: Int = 0
    @AppStorage("weightSource") private var weightSource: String = "profile"
    @AppStorage("lastWithingsWeightKg") private var lastWithingsWeightKg: Double = 0
    @AppStorage("withingsLastStartupSyncAt") private var withingsLastStartupSyncAt: Double = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            // Home screen (default)
            HomeView(selectedTab: $selectedTab)
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }
                .tag(0)
            
            // Dashboard (auto-shown when run starts)
            DashboardView()
                .tabItem {
                    Label("Coach", systemImage: "figure.run")
                }
                .tag(1)
            
            ActivityBuilderView()
                .tabItem {
                    Label("Build", systemImage: "hammer")
                }
                .tag(2)
            
            HistoryView()
                .tabItem {
                    Label("History", systemImage: "clock.arrow.circlepath")
                }
                .tag(3)
            
            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(4)
        }
        .onAppear {
            connectivity.bind(modelContext: modelContext)
            DiagnosticLogManager.shared.bind(modelContext)
            bootstrapLiveCoachTemplate()

            Task {
                await AuthService.shared.bootstrap()
                await EntitlementService.shared.refresh()
            }

            // Force check application context on appear
            connectivity.checkForRunState()
            // Check for active run immediately on appear
            if connectivity.isRunActive && selectedTab != 1 {
                print("📱 Found active run on appear, switching to Dashboard")
                selectedTab = 1
            }

            Task {
                await syncWithingsWeightsOnStartupIfNeeded()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            // Check for run state when app comes to foreground
            connectivity.checkForRunState()
            if connectivity.isRunActive && selectedTab != 1 {
                print("📱 Found active run on foreground, switching to Dashboard")
                selectedTab = 1
            }
        }
        .onChange(of: connectivity.isRunActive) { oldValue, newValue in
            // Automatically switch to Dashboard when run starts
            print("📱 Run state changed: \(oldValue) -> \(newValue), current tab: \(selectedTab)")
            if newValue && selectedTab != 1 {
                print("📱 Switching to Dashboard tab")
                withAnimation {
                    selectedTab = 1
                }
            }
        }
    }

    @MainActor
    private func syncWithingsWeightsOnStartupIfNeeded() async {
        guard weightSource == "withings" else { return }
        let now = Date().timeIntervalSince1970
        let minInterval: TimeInterval = 4 * 60 * 60
        guard now - withingsLastStartupSyncAt >= minInterval else { return }
        guard CloudTokenStorage.shared.hasTokens(provider: "withings") else { return }

        withingsLastStartupSyncAt = now

        do {
            let result = try await WithingsService.shared.syncRecentWeights(modelContext: modelContext, daysBack: 120)
            if let latestKg = result.latestKg {
                lastWithingsWeightKg = latestKg
                try applyWithingsWeightToProfile(latestKg)
                ConnectivityManager.shared.syncWithingsWeightToWatch(latestKg)
            }
            if result.imported > 0 {
                print("📱 Withings startup sync imported \(result.imported) weight entr\(result.imported == 1 ? "y" : "ies").")
            }
        } catch {
            print("⚠️ Withings startup sync failed: \(error.localizedDescription)")
        }
    }

    @MainActor
    private func bootstrapLiveCoachTemplate() {
        let descriptor = FetchDescriptor<ActivityTemplate>()
        if let templates = try? modelContext.fetch(descriptor),
           !templates.contains(where: { $0.name == "Live Coach" }) {
            let liveCoach = ActivityTemplate(
                name: "Live Coach",
                icon: "sparkles",
                primaryScreen: .coach,
                secondaryScreens: [.npi, .metrics, .map],
                goal: .efficiency,
                isCustom: false
            )
            modelContext.insert(liveCoach)
            print("📱 Bootstrapped 'Live Coach' activity template")
        }
    }

    @MainActor
    private func applyWithingsWeightToProfile(_ kg: Double) throws {
        guard kg > 0 else { return }
        let descriptor = FetchDescriptor<RunnerProfile>()
        if let profile = try modelContext.fetch(descriptor).first {
            profile.weightKg = kg
        } else {
            modelContext.insert(RunnerProfile(weightKg: kg))
        }
        try modelContext.save()
    }
}


