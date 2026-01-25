import SwiftUI
import CoreLocation

// MARK: - MAIN CONTENT VIEW
struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @StateObject private var locationManager = LocationManager()
    @StateObject private var aiCoach = AICoach()
    @StateObject private var formCoach = FormCoach()
    @AppStorage("skipHomeScreen") private var skipHomeScreen: Bool = false
    
    // Persistent Settings
    @AppStorage("targetNPI") private var targetNPI: Double = 135.0
    @AppStorage("unitSystem") private var unitSystem: String = "metric"
    @AppStorage("physioMode") private var physioMode: Bool = false
    
    @State private var navigationPath: [String] = []
    
    var body: some View {
        NavigationStack(path: $navigationPath) {
            Group {
                if skipHomeScreen {
                    PresetSelectionView(locationManager: locationManager, navigationPath: $navigationPath)
                } else {
                    HomeView(locationManager: locationManager, navigationPath: $navigationPath)
                }
            }
            .navigationDestination(for: String.self) { destination in
                switch destination {
                case "RunView":
                    MainTabView(locationManager: locationManager, aiCoach: aiCoach, formCoach: formCoach, targetNPI: $targetNPI, unitSystem: $unitSystem, physioMode: $physioMode, navigationPath: $navigationPath)
                        .navigationBarBackButtonHidden(true)
                case "Activities":
                    PresetSelectionView(locationManager: locationManager, navigationPath: $navigationPath)
                case "Settings":
                    SettingsView(locationManager: locationManager, targetNPI: $targetNPI, unitSystem: $unitSystem, physioMode: $physioMode, formCoach: formCoach, navigationPath: $navigationPath)
                default:
                    EmptyView()
                }
            }
        }
    }
}

struct MainTabView: View {
    @ObservedObject var locationManager: LocationManager
    @ObservedObject var aiCoach: AICoach
    @ObservedObject var formCoach: FormCoach
    @Binding var targetNPI: Double
    @Binding var unitSystem: String
    @Binding var physioMode: Bool
    @Binding var navigationPath: [String]
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            // PAGE 1: RUN DASHBOARD
            RunView(locationManager: locationManager, aiCoach: aiCoach, formCoach: formCoach, targetNPI: targetNPI, unitSystem: unitSystem, physioMode: physioMode, navigationPath: $navigationPath)
                .tag(0)
            
            // PAGE 2: SETTINGS
            SettingsView(locationManager: locationManager, targetNPI: $targetNPI, unitSystem: $unitSystem, physioMode: $physioMode, formCoach: formCoach, navigationPath: $navigationPath)
                .tag(1)
            
            // PAGE 3: HISTORY
            NavigationStack {
                HistoryView(unitSystem: unitSystem, navigationPath: $navigationPath)
            }
            .tag(2)
            
            // PAGE 4: USER MANUAL
            ManualView(navigationPath: $navigationPath)
                .tag(3)
        }
        .tabViewStyle(.verticalPage)
    }
}
