import SwiftUI

struct PresetSelectionView: View {
    @ObservedObject var locationManager: LocationManager
    @Binding var navigationPath: [String] // Or simple boolean state
    
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
            Button(action: {}) {
                HStack {
                    Image(systemName: "arrow.triangle.2.circlepath")
                    Text("Sync from iPhone")
                }
                .font(.caption)
                .foregroundColor(.gray)
            }
            .listRowBackground(Color.clear)
        }
    }
}

