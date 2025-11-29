import SwiftUI
import SwiftData
#if os(watchOS)
import WatchKit
#endif

// MARK: - PAGE 1: RUN VIEW
struct RunView: View {
    @Environment(\.modelContext) private var modelContext
    @ObservedObject var locationManager: LocationManager
    @ObservedObject var aiCoach: AICoach
    let targetNPI: Double
    let unitSystem: String
    let physioMode: Bool
    
    @State private var showFireworks = false
    @State private var hasCelebrated = false
    @State private var showPhysioAlert = false
    
    var body: some View {
        ZStack {
            // Visual Outline Progress
            ScreenOutline(current: locationManager.liveNPI, target: targetNPI)
            
            if showFireworks { FireworksView() }
            
            VStack {
                // HEADER
                HStack {
                    Text("KINETIX").font(.system(size: 10, weight: .black)).italic()
                    Spacer()
                    Text(locationManager.isRunning ? "LIVE" : "READY")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(locationManager.isRunning ? .cyan : .gray)
                }
                .padding(.top, 10).padding(.horizontal)
                
                Spacer()
                
                // MAIN GAUGE
                VStack(spacing: 5) {
                    HStack(spacing: 4) {
                        Text("TARGET").font(.system(size: 8, weight: .bold)).foregroundColor(.gray)
                        Text("\(Int(targetNPI))").font(.system(size: 12, weight: .bold)).foregroundColor(.cyan)
                    }
                    .padding(4).background(Capsule().stroke(Color.gray.opacity(0.5), lineWidth: 1))
                    
                    Text("\(Int(locationManager.liveNPI))")
                        .font(.system(size: 56, weight: .black, design: .rounded))
                        .italic()
                        .foregroundColor(locationManager.liveNPI >= targetNPI ? .green : .white)
                        .contentTransition(.numericText())
                    
                    Text("INDEX").font(.system(size: 8, weight: .bold)).tracking(2).foregroundColor(.gray).offset(y: -5)
                    
                    // DYNAMIC PROJECTION
                    if locationManager.isRunning, let proj = locationManager.timeToBeat {
                        HStack(spacing: 4) {
                            Image(systemName: "flag.fill").font(.system(size: 8)).foregroundColor(.orange)
                            Text(proj)
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(proj.contains("GO") ? .green : .orange)
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                        }
                        .padding(4).background(Color.gray.opacity(0.2)).cornerRadius(4)
                    }
                }
                
                Spacer()
                
                if locationManager.isRunning {
                    RunnerTrack(current: locationManager.liveNPI, target: targetNPI)
                        .frame(height: 20)
                        .padding(.horizontal)
                }
                
                // STATS GRID
                HStack(spacing: 2) {
                    StatBox(title: "PACE", value: locationManager.formattedPace(unit: unitSystem), color: .cyan)
                    if physioMode {
                        StatBox(title: "BPM", value: "\(Int(locationManager.heartRate))", color: locationManager.heartRate > 170 ? .red : .white)
                    }
                    StatBox(title: "DIST", value: locationManager.formattedDistance(unit: unitSystem), color: .purple)
                }
                .padding(.horizontal)
                
                // START/STOP
                Button(action: {
                    if let summary = locationManager.toggleTracking(targetNPI: targetNPI) {
                        // Save Run
                        let run = Run(
                            date: summary.date,
                            distance: summary.distance,
                            duration: summary.duration,
                            avgPace: summary.avgPace,
                            avgNPI: summary.avgNPI,
                            avgHeartRate: summary.avgHeartRate
                        )
                        modelContext.insert(run)
                        
                        // Optional: Trigger AI analysis or show summary
                        // aiCoach.analyzeRun(distance: summary.distance/1000, pace: locationManager.formattedPace(unit: unitSystem), npi: summary.avgNPI, pb: targetNPI)
                    }
                }) {
                    Image(systemName: locationManager.isRunning ? "stop.fill" : "play.fill")
                }
                .background(locationManager.isRunning ? Color.red : Color.green)
                .clipShape(Circle())
                .padding(.bottom, 5)
            }
        }
        // PHYSIO ALERT
        .alert("Cardiac Drift", isPresented: $showPhysioAlert) {
            Button("Ignore", role: .cancel) { }
            Button("Okay", role: .none) { }
        } message: {
            Text("Efficiency dropping. Rec Pace: \(locationManager.recommendedPaceString(unit: unitSystem))")
        }
        // WINNING LOGIC (ROUNDED)
        .onChange(of: locationManager.liveNPI) { _, newValue in
            // Check rounded value to match UI (Visual Win)
            if round(newValue) >= targetNPI && !hasCelebrated {
                hasCelebrated = true
                showFireworks = true
                #if os(watchOS)
                WKInterfaceDevice.current().play(.success)
                // S.O.S Haptic Pattern
                let device = WKInterfaceDevice.current()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { device.play(.click) }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { device.play(.click) }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { device.play(.click) }
                #endif
                DispatchQueue.main.asyncAfter(deadline: .now() + 4) { showFireworks = false }
            }
        }
        .onChange(of: locationManager.heartRate) { _, newHR in
            if physioMode && newHR > 175 && !showPhysioAlert { showPhysioAlert = true }
        }
        .onAppear {
            if !locationManager.isRunning { hasCelebrated = false }
        }
        // AI Overlay
        .sheet(isPresented: Binding<Bool>(
            get: { aiCoach.isAnalyzing || aiCoach.result != nil },
            set: { if !$0 { aiCoach.isAnalyzing = false; aiCoach.result = nil } }
        )) {
            if aiCoach.isAnalyzing {
                VStack { ProgressView("Analyzing...") }
            } else if let res = aiCoach.result {
                ScrollView {
                    VStack(spacing: 10) {
                        Text(res.title).font(.headline).foregroundColor(.cyan)
                        Divider()
                        Text(res.insight).font(.caption).foregroundColor(.white)
                        Button("Close") { aiCoach.result = nil }.padding(.top)
                    }.padding()
                }
            }
        }
    }
}

