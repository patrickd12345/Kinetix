import SwiftUI

struct SettingsView: View {
    var body: some View {
        NavigationStack {
            List {
                Section(header: Text("Workout Presets")) {
                    NavigationLink("Custom Presets") {
                        Text("Preset Editor Coming Soon")
                    }
                    NavigationLink("Sync to Watch") {
                        Text("Syncing...")
                    }
                }
                
                Section(header: Text("Profile")) {
                    HStack {
                        Text("Target NPI")
                        Spacer()
                        Text("135")
                    }
                }
                
                Section(header: Text("App Info")) {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0 (Beta)")
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }
}

