import SwiftUI
import SwiftData

struct BatteryProfileEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    
    let profile: CustomBatteryProfile?
    var onSave: ((String) -> Void)? = nil
    
    @State private var name: String = ""
    @State private var gpsInterval: Double = 2.0
    @State private var motionSensorInterval: Double = 2.0
    @State private var formAnalysisInterval: Double = 15.0
    @State private var saveInterval: Double = 60.0
    @State private var allowHaptics: Bool = true
    @State private var allowVoice: Bool = true
    @State private var allowLiveCharts: Bool = true
    
    @State private var showingDeleteConfirmation = false
    @State private var showingSaveConfirmation = false
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Profile Name", text: $name)
                } header: {
                    Text("Profile Name")
                }
                
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("GPS Interval: \(Int(gpsInterval))s")
                            .font(.subheadline)
                        Slider(value: $gpsInterval, in: 1...30, step: 1)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Motion Sensor Interval: \(Int(motionSensorInterval))s")
                            .font(.subheadline)
                        Slider(value: $motionSensorInterval, in: 1...30, step: 1)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Form Analysis Interval: \(Int(formAnalysisInterval))s")
                            .font(.subheadline)
                        Slider(value: $formAnalysisInterval, in: 5...120, step: 5)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Save Interval: \(Int(saveInterval))s")
                            .font(.subheadline)
                        Slider(value: $saveInterval, in: 30...600, step: 30)
                    }
                } header: {
                    Text("Sampling Intervals")
                } footer: {
                    Text("Lower intervals = more precision but higher battery drain. Higher intervals = longer battery life but less frequent updates.")
                }
                
                Section {
                    Toggle("Allow Haptics", isOn: $allowHaptics)
                    Toggle("Allow Voice Alerts", isOn: $allowVoice)
                    Toggle("Allow Live Charts", isOn: $allowLiveCharts)
                } header: {
                    Text("Features")
                } footer: {
                    Text("Disable features to save battery. Voice alerts require the iPhone companion app.")
                }
                
                if profile != nil {
                    Section {
                        Button("Delete Profile", role: .destructive) {
                            showingDeleteConfirmation = true
                        }
                    }
                }
            }
            .navigationTitle(profile == nil ? "New Battery Profile" : "Edit Battery Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { saveProfile() }
                        .disabled(name.isEmpty)
                }
            }
            .alert("Delete Profile?", isPresented: $showingDeleteConfirmation) {
                Button("Delete", role: .destructive) { deleteProfile() }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text("This will permanently delete this battery profile. This action cannot be undone.")
            }
            .alert("Profile Saved", isPresented: $showingSaveConfirmation) {
                Button("OK", role: .cancel) {
                    // Only dismiss if this is a sheet (has onSave callback)
                    // NavigationLink versions will stay open so user can continue editing
                    if onSave != nil {
                        dismiss()
                    }
                }
            } message: {
                Text("Battery profile \"\(name)\" saved successfully and synced to Watch.")
            }
            .onAppear {
                loadProfile()
            }
        }
    }
    
    private func loadProfile() {
        if let profile = profile {
            name = profile.name
            gpsInterval = profile.gpsInterval
            motionSensorInterval = profile.motionSensorInterval
            formAnalysisInterval = profile.formAnalysisInterval
            saveInterval = profile.saveInterval
            allowHaptics = profile.allowHaptics
            allowVoice = profile.allowVoice
            allowLiveCharts = profile.allowLiveCharts
        }
    }
    
    private func saveProfile() {
        if let existing = profile {
            existing.name = name
            existing.gpsInterval = gpsInterval
            existing.motionSensorInterval = motionSensorInterval
            existing.formAnalysisInterval = formAnalysisInterval
            existing.saveInterval = saveInterval
            existing.allowHaptics = allowHaptics
            existing.allowVoice = allowVoice
            existing.allowLiveCharts = allowLiveCharts
            existing.lastModified = Date()
        } else {
            let newProfile = CustomBatteryProfile(
                name: name,
                gpsInterval: gpsInterval,
                motionSensorInterval: motionSensorInterval,
                formAnalysisInterval: formAnalysisInterval,
                saveInterval: saveInterval,
                allowHaptics: allowHaptics,
                allowVoice: allowVoice,
                allowLiveCharts: allowLiveCharts
            )
            modelContext.insert(newProfile)
        }
        
        // Sync to Watch
        ConnectivityManager.shared.syncBatteryProfiles()
        
        // Show confirmation
        showingSaveConfirmation = true
        onSave?(name) // Notify parent if callback provided
    }
    
    private func deleteProfile() {
        if let profile = profile {
            modelContext.delete(profile)
            ConnectivityManager.shared.syncBatteryProfiles()
            dismiss()
        }
    }
}

