import SwiftUI
import SwiftData

struct MainTabView: View {
    @Environment(\.modelContext) private var modelContext
    @ObservedObject private var connectivity = ConnectivityManager.shared
    @State private var selectedTab: Int = 0
    @AppStorage("weightSource") private var weightSource: String = "profile"
    @AppStorage("lastWithingsWeightKg") private var lastWithingsWeightKg: Double = 0
    @AppStorage("withingsLastStartupSyncAt") private var withingsLastStartupSyncAt: Double = 0
    @AppStorage("stravaLastStartupSyncAt") private var stravaLastStartupSyncAt: Double = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            // Home screen (default)
            HomeView(selectedTab: $selectedTab)
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }
                .tag(0)
                .accessibilityIdentifier("KinetixTab.home")
            
            // Dashboard (auto-shown when run starts)
            DashboardView()
                .tabItem {
                    Label("Coach", systemImage: "figure.run")
                }
                .tag(1)
                .accessibilityIdentifier("KinetixTab.coach")
            
            ActivityBuilderView()
                .tabItem {
                    Label("Build", systemImage: "hammer")
                }
                .tag(2)
                .accessibilityIdentifier("KinetixTab.build")
            
            HistoryView()
                .tabItem {
                    Label("History", systemImage: "clock.arrow.circlepath")
                }
                .tag(3)
                .accessibilityIdentifier("KinetixTab.history")
            
            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(4)
                .accessibilityIdentifier("KinetixTab.settings")
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
                await syncStravaRunsOnStartupIfNeeded()
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
    private func syncStravaRunsOnStartupIfNeeded() async {
        let now = Date().timeIntervalSince1970
        let minInterval: TimeInterval = 4 * 60 * 60
        guard now - stravaLastStartupSyncAt >= minInterval else { return }
        guard CloudTokenStorage.shared.hasTokens(provider: "strava") else { return }
        stravaLastStartupSyncAt = now

        do {
            guard let tokens = try CloudTokenStorage.shared.getTokens(provider: "strava") else { return }
            var accessToken = tokens.accessToken
            if !CloudTokenStorage.shared.isTokenValid(provider: "strava") {
                let refreshed = try await StravaService.shared.refreshAccessToken(refreshToken: tokens.refreshToken)
                try CloudTokenStorage.shared.storeTokens(
                    provider: "strava",
                    accessToken: refreshed.accessToken,
                    refreshToken: refreshed.refreshToken,
                    expiresAt: refreshed.expiresAt
                )
                accessToken = refreshed.accessToken
            }

            let activities = try await StravaService.shared.fetchActivities(accessToken: accessToken, days: 30)
            let existingRuns = try modelContext.fetch(FetchDescriptor<Run>())
            var importedRuns: [Run] = []

            for activity in activities {
                guard activity.type == "Run" || activity.sport_type == "Run" else { continue }
                guard activity.distance > 0, activity.moving_time > 0 else { continue }
                guard let activityDate = ISO8601DateFormatter().date(from: activity.start_date) else { continue }

                let externalSource = "strava:\(activity.id)"
                if existingRuns.contains(where: { $0.source == externalSource }) { continue }

                let duplicate = existingRuns.contains { run in
                    abs(run.date.timeIntervalSince(activityDate)) < 1 &&
                    abs(run.distance - activity.distance) < 1 &&
                    abs(run.duration - Double(activity.moving_time)) < 1
                }
                if duplicate { continue }

                let distanceKm = activity.distance / 1000.0
                let paceSecondsPerKm = Double(activity.moving_time) / distanceKm
                let npi = (3600.0 / paceSecondsPerKm) * pow(distanceKm, 0.06) * 10.0

                let run = Run(
                    date: activityDate,
                    source: externalSource,
                    distance: activity.distance,
                    duration: Double(activity.moving_time),
                    avgPace: paceSecondsPerKm,
                    avgNPI: npi,
                    avgHeartRate: activity.average_heartrate ?? 0,
                    avgCadence: activity.average_cadence != nil ? activity.average_cadence! * 2 : nil,
                    avgVerticalOscillation: nil,
                    avgGroundContactTime: nil,
                    avgStrideLength: nil,
                    formScore: nil,
                    routeData: []
                )
                modelContext.insert(run)
                importedRuns.append(run)
            }

            if !importedRuns.isEmpty {
                try modelContext.save()
                _ = try await SupabaseRunSyncService.shared.upsertRuns(importedRuns)
                print("📱 Strava startup sync imported \(importedRuns.count) run(s).")
            }
        } catch {
            print("⚠️ Strava startup sync failed: \(error.localizedDescription)")
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

