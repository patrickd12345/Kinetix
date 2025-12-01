import SwiftUI
import SwiftData

struct ActivityEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    
    let template: ActivityTemplate?
    var onSave: (ActivityTemplate) -> Void
    
    @State private var name: String
    @State private var icon: String
    @State private var primaryScreen: ActivityScreenType
    @State private var secondaryScreens: Set<ActivityScreenType>
    @State private var goal: ActivityGoalType
    @State private var batteryProfile: BatteryProfileType
    @State private var feedback: FeedbackSettings
    
    private let iconOptions = ["figure.run", "waveform.path.ecg", "bolt.heart", "flame", "speedometer", "scope", "location.north", "sparkles", "dot.viewfinder", "metronome.fill", "lungs.fill", "figure.core.training"]
    
    init(template: ActivityTemplate?, onSave: @escaping (ActivityTemplate) -> Void) {
        self.template = template
        self.onSave = onSave
        
        let starting = template ?? ActivityTemplate(
            name: "Form Monitor",
            icon: "dot.viewfinder",
            primaryScreen: .bubble,
            secondaryScreens: [.metrics, .pace, .npi],
            feedback: FeedbackSettings(),
            goal: .formMonitor,
            defaultBatteryProfile: .balanced,
            isCustom: true
        )
        
        _name = State(initialValue: starting.name)
        _icon = State(initialValue: starting.icon)
        _primaryScreen = State(initialValue: starting.primaryScreen)
        _secondaryScreens = State(initialValue: Set(starting.secondaryScreens))
        _goal = State(initialValue: starting.goal)
        _batteryProfile = State(initialValue: starting.defaultBatteryProfile)
        _feedback = State(initialValue: starting.feedback)
    }
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    GroupBox("Identity") {
                        VStack(alignment: .leading, spacing: 12) {
                            TextField("Name", text: $name)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                            
                            Text("Icon")
                                .font(.caption)
                                .foregroundColor(.gray)
                            
                            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
                                ForEach(iconOptions, id: \.self) { option in
                                    Button {
                                        icon = option
                                    } label: {
                                        Image(systemName: option)
                                            .frame(maxWidth: .infinity, minHeight: 36)
                                            .padding()
                                            .background(icon == option ? Color.blue.opacity(0.15) : Color(UIColor.secondarySystemBackground))
                                            .foregroundColor(icon == option ? .blue : .primary)
                                            .cornerRadius(10)
                                    }
                                }
                            }
                        }
                    }
                    
                    GroupBox("Screens") {
                        VStack(alignment: .leading, spacing: 10) {
                            Picker("Primary Screen", selection: $primaryScreen) {
                                ForEach(ActivityScreenType.allCases) { screen in
                                    Text(screen.label).tag(screen)
                                }
                            }
                            .pickerStyle(.navigationLink)
                            
                            Text("Secondary Screens")
                                .font(.caption)
                                .foregroundColor(.gray)
                            
                            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                                ForEach(ActivityScreenType.allCases) { screen in
                                    Toggle(isOn: Binding(
                                        get: { secondaryScreens.contains(screen) },
                                        set: { isOn in
                                            if isOn {
                                                secondaryScreens.insert(screen)
                                            } else {
                                                secondaryScreens.remove(screen)
                                            }
                                        }
                                    )) {
                                        Text(screen.label)
                                            .font(.caption2)
                                            .lineLimit(1)
                                    }
                                    .toggleStyle(.button)
                                    .tint(.cyan)
                                }
                            }
                        }
                    }
                    
                    GroupBox("Feedback") {
                        VStack(spacing: 12) {
                            Toggle("Haptics", isOn: $feedback.hapticsEnabled)
                            Toggle("Speech", isOn: $feedback.speechEnabled)
                            Toggle("Symmetry Cues", isOn: $feedback.symmetryHaptics)
                            Toggle("Sonic Feedback", isOn: $feedback.sonicEnabled)
                            
                            VStack(alignment: .leading) {
                                HStack {
                                    Text("Bubble Sensitivity")
                                    Spacer()
                                    Text(String(format: "%.1f×", feedback.bubbleSensitivity))
                                        .font(.caption)
                                        .foregroundColor(.gray)
                                }
                                Slider(value: $feedback.bubbleSensitivity, in: 0.6...1.6, step: 0.1)
                            }
                            
                            if feedback.sonicEnabled {
                                VStack(alignment: .leading) {
                                    HStack {
                                        Text("Sonic Sensitivity")
                                        Spacer()
                                        Text(String(format: "%.1f×", feedback.sonicSensitivity))
                                            .font(.caption)
                                            .foregroundColor(.gray)
                                    }
                                    Slider(value: $feedback.sonicSensitivity, in: 0.5...1.8, step: 0.1)
                                }
                            }
                        }
                    }
                    
                    GroupBox("Goal & Battery") {
                        Picker("Goal Type", selection: $goal) {
                            ForEach(ActivityGoalType.allCases) { goal in
                                Text(goal.displayName).tag(goal)
                            }
                        }
                        .pickerStyle(.navigationLink)
                        
                        Picker("Battery Profile", selection: $batteryProfile) {
                            ForEach(BatteryProfileType.allCases) { profile in
                                Text(profile.description).tag(profile)
                            }
                        }
                        .pickerStyle(.navigationLink)
                    }
                    
                    Button(action: save) {
                        HStack {
                            Spacer()
                            Text("Save & Sync")
                                .font(.headline)
                            Spacer()
                        }
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                }
                .padding()
            }
            .navigationTitle(template == nil ? "New Activity" : "Edit Activity")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
    
    private func save() {
        let record = template ?? ActivityTemplate(
            name: name,
            icon: icon,
            primaryScreen: primaryScreen,
            secondaryScreens: Array(secondaryScreens),
            feedback: feedback,
            goal: goal,
            defaultBatteryProfile: batteryProfile,
            isCustom: true
        )
        
        record.name = name
        record.icon = icon
        record.primaryScreen = primaryScreen
        record.secondaryScreens = Array(secondaryScreens)
        record.feedback = feedback
        record.goal = goal
        record.defaultBatteryProfile = batteryProfile
        record.lastModified = Date()
        record.isCustom = true
        
        if template == nil {
            modelContext.insert(record)
        }
        
        onSave(record)
        dismiss()
    }
}
