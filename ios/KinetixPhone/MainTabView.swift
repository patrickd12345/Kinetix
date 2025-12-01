import SwiftUI

struct MainTabView: View {
    @Environment(\.modelContext) private var modelContext
    @StateObject private var connectivity = ConnectivityManager.shared
    
    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("Coach", systemImage: "figure.run")
                }
            
            ActivityBuilderView()
                .tabItem {
                    Label("Build", systemImage: "hammer")
                }
            
            HistoryView()
                .tabItem {
                    Label("History", systemImage: "clock.arrow.circlepath")
                }
            
            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
        }
        .onAppear {
            connectivity.bind(modelContext: modelContext)
        }
    }
}


