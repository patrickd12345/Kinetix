import SwiftUI

// MARK: - PAGE 2: SETTINGS
struct SettingsView: View {
    @Binding var targetNPI: Double; @Binding var unitSystem: String; @Binding var physioMode: Bool
    @ObservedObject var formCoach: FormCoach
    
    var body: some View {
        List {
            Section(header: Text("GOALS")) {
                VStack(spacing: 8) {
                    Text("TARGET NPI").font(.system(size: 12, weight: .bold)).foregroundColor(.gray)
                    
                    // Fine Adjustment (+/- 1)
                    HStack {
                        Button(action: { if targetNPI > 50 { targetNPI -= 1 } }) {
                            Image(systemName: "minus.circle.fill").font(.title2).foregroundColor(.gray)
                        }
                        .buttonStyle(.plain)
                        
                        Spacer()
                        Text("\(Int(targetNPI))")
                            .font(.system(size: 32, weight: .black, design: .rounded))
                            .foregroundColor(.cyan)
                        Spacer()
                        
                        Button(action: { if targetNPI < 200 { targetNPI += 1 } }) {
                            Image(systemName: "plus.circle.fill").font(.title2).foregroundColor(.gray)
                        }
                        .buttonStyle(.plain)
                    }
                    
                    // Coarse Adjustment (+/- 5)
                    HStack {
                        Button(action: { if targetNPI > 55 { targetNPI -= 5 } }) {
                            Text("--").font(.caption).fontWeight(.black).foregroundColor(.gray).padding(6).background(Color.gray.opacity(0.2)).clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                        
                        Spacer()
                        
                        Button(action: { if targetNPI < 195 { targetNPI += 5 } }) {
                            Text("++").font(.caption).fontWeight(.black).foregroundColor(.gray).padding(6).background(Color.gray.opacity(0.2)).clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 5)
                
                Toggle("Physio-Pacer", isOn: $physioMode)
            }
            
            Section(header: Text("FORM COACH")) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Coach Mode").font(.system(size: 12, weight: .bold))
                    Text(formCoach.modeDescription)
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                }
                
                Picker("Mode", selection: Binding(
                    get: { formCoach.currentMode },
                    set: { formCoach.setMode($0) }
                )) {
                    Text("Auto").tag(CoachMode.auto)
                    Text("Rule-Based").tag(CoachMode.ruleBased)
                    Text("Core ML").tag(CoachMode.coreML)
                }
                
                // Show learning status in auto mode
                if formCoach.currentMode == .auto {
                    let sampleCount = formCoach.getTrainingSampleCount()
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Learning Status").font(.system(size: 10, weight: .bold))
                        Text("\(sampleCount) samples collected")
                            .font(.system(size: 9))
                            .foregroundColor(.gray)
                        Text("Model adapts as you run")
                            .font(.system(size: 8))
                            .foregroundColor(.gray.opacity(0.7))
                    }
                }
            }
            
            Section(header: Text("SYSTEM")) { 
                Picker("Units", selection: $unitSystem) { 
                    Text("Metric").tag("metric")
                    Text("Imperial").tag("imperial") 
                }
                
                #if DEBUG
                NavigationLink("UI Audit") {
                    UIAuditView()
                }
                #endif
            }
        }
    }
}


