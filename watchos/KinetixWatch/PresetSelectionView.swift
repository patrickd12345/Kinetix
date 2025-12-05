import SwiftUI
import SwiftData

struct PresetSelectionView: View {
    @ObservedObject var locationManager: LocationManager
    @Binding var navigationPath: [String] // Or simple boolean state
    @Environment(\.modelContext) private var modelContext
    @Query(sort: [SortDescriptor<ActivityTemplate>(\.lastModified, order: .reverse)]) private var activities: [ActivityTemplate]
    
    let presets = WorkoutPreset.builtInPresets()
    
    var body: some View {
        List {
            Text("Select Workout")
                .font(.headline)
                .listRowBackground(Color.clear)
            
            ForEach(presets) { preset in
                Button(action: {
                    locationManager.setPreset(preset)
                    withAnimation {
                        navigationPath.append("RunView")
                    }
                }) {
                    VStack(alignment: .leading) {
                        Text(preset.name)
                            .font(.headline)
                            .foregroundColor(.cyan)
                        Text(preset.type.rawValue)
                            .font(.caption2)
                            .foregroundColor(.gray)
                        
                        HStack {
                            Image(systemName: "battery.100")
                            Text(preset.defaultBatteryProfile.rawValue.capitalized)
                        }
                        .font(.system(size: 8))
                        .foregroundColor(.yellow)
                        .padding(.top, 2)
                    }
                    .padding(.vertical, 4)
                }
            }
            
            // Sync Placeholder
            Button(action: {
                locationManager.requestActivitySync()
            }) {
                HStack {
                    Image(systemName: "arrow.triangle.2.circlepath")
                    Text("Sync from iPhone")
                }
                .font(.caption)
                .foregroundColor(.gray)
            }
            .listRowBackground(Color.clear)
            
            if !activities.isEmpty {
                Section(header: Text("Custom").font(.caption).foregroundColor(.gray)) {
                    ForEach(activities) { activity in
                        Button {
                            locationManager.setActivityTemplate(activity)
                            withAnimation {
                                navigationPath.append("RunView")
                            }
                        } label: {
                            HStack {
                                Image(systemName: activity.icon)
                                VStack(alignment: .leading) {
                                    Text(activity.name).font(.headline)
                                    Text(activity.goal.displayName)
                                        .font(.caption2)
                                        .foregroundColor(.gray)
                                }
                                Spacer()
                                Text(activity.primaryScreen.label)
                                    .font(.caption2)
                                    .foregroundColor(.cyan)
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }
                .listRowBackground(Color.clear)
            }
        }
        .onAppear {
            // Pull latest activities pushed from phone (already persisted)
            _ = modelContext // touch context to ensure SwiftData is loaded
        }
    }
}










