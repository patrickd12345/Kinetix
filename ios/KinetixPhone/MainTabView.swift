import SwiftUI

struct MainTabView: View {
    @Environment(\.modelContext) private var modelContext
    @ObservedObject private var connectivity = ConnectivityManager.shared
    @State private var selectedTab: Int = 0
    
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
            
            // Force check application context on appear
            connectivity.checkForRunState()
            // Check for active run immediately on appear
            if connectivity.isRunActive && selectedTab != 1 {
                print("📱 Found active run on appear, switching to Dashboard")
                selectedTab = 1
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
}


