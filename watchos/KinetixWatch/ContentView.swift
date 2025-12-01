import SwiftUI
import CoreLocation

// MARK: - MAIN CONTENT VIEW
struct ContentView: View {
    @StateObject private var locationManager = LocationManager()
    @StateObject private var aiCoach = AICoach()
    @StateObject private var formCoach = FormCoach()
    
    // Persistent Settings
    @AppStorage("targetNPI") private var targetNPI: Double = 135.0
    @AppStorage("unitSystem") private var unitSystem: String = "metric"
    @AppStorage("physioMode") private var physioMode: Bool = false
    
    @State private var navigationPath: [String] = []
    
    var body: some View {
        NavigationStack(path: $navigationPath) {
            PresetSelectionView(locationManager: locationManager, navigationPath: $navigationPath)
                .navigationDestination(for: String.self) { destination in
                    if destination == "RunView" {
                        MainTabView(locationManager: locationManager, aiCoach: aiCoach, formCoach: formCoach, targetNPI: $targetNPI, unitSystem: $unitSystem, physioMode: $physioMode)
                            .navigationBarBackButtonHidden(true)
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
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            // PAGE 1: RUN DASHBOARD
            RunView(locationManager: locationManager, aiCoach: aiCoach, formCoach: formCoach, targetNPI: targetNPI, unitSystem: unitSystem, physioMode: physioMode)
                .tag(0)
            
            // PAGE 2: SETTINGS
            SettingsView(targetNPI: $targetNPI, unitSystem: $unitSystem, physioMode: $physioMode, formCoach: formCoach)
                .tag(1)
            
            // PAGE 3: HISTORY
            NavigationStack {
                HistoryView(unitSystem: unitSystem)
            }
            .tag(2)
            
            // PAGE 4: USER MANUAL
            ManualView()
                .tag(3)
        }
        .tabViewStyle(.verticalPage)
    }
}
