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
    @ObservedObject var formCoach: FormCoach
    let targetNPI: Double
    let unitSystem: String
    let physioMode: Bool
    
    @State private var showFireworks = false
    @State private var hasCelebrated = false
    @State private var showPhysioAlert = false
    @State private var formTimer: Timer?
    
    // Error & Recovery Alerts
    @State private var showGPSError = false
    @State private var showHealthKitError = false
    @State private var showWorkoutError = false
    @State private var showRecoveryPrompt = false
    @State private var showInvalidRunAlert = false
    
    var body: some View {
        mainContentView
            .attachPhysioAlert(showPhysioAlert: $showPhysioAlert, locationManager: locationManager, unitSystem: unitSystem)
            .attachGPSErrorAlert(showGPSError: $showGPSError, locationManager: locationManager)
            .attachHealthKitErrorAlert(showHealthKitError: $showHealthKitError, locationManager: locationManager)
            .attachWorkoutErrorAlert(showWorkoutError: $showWorkoutError, locationManager: locationManager)
            .attachRecoveryPrompt(showRecoveryPrompt: $showRecoveryPrompt, locationManager: locationManager, unitSystem: unitSystem)
            .attachInvalidRunAlert(showInvalidRunAlert: $showInvalidRunAlert, locationManager: locationManager, targetNPI: targetNPI, modelContext: modelContext)
            .attachChangeHandlers(
                locationManager: locationManager,
                physioMode: physioMode,
                targetNPI: targetNPI,
                hasCelebrated: $hasCelebrated,
                showFireworks: $showFireworks,
                showPhysioAlert: $showPhysioAlert,
                formCoach: formCoach
            )
            .onAppear {
                if !locationManager.isRunning { hasCelebrated = false }
                if locationManager.checkForRecovery() != nil {
                    showRecoveryPrompt = true
                }
            }
            .onChange(of: locationManager.isRunning) { _, isRunning in
                if isRunning {
                    startFormEvaluation()
                } else {
                    stopFormEvaluation()
                }
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
    
    private var mainContentView: some View {
        ZStack {
            // Visual Outline Progress
            ScreenOutline(current: locationManager.liveNPI, target: targetNPI)
            
            if showFireworks { FireworksView() }
            
            VStack {
                // HEADER
                HStack {
                    Text("KINETIX").font(.system(size: 10, weight: .black)).italic()
                    Spacer()
                    
                    // Status with GPS indicator
                    HStack(spacing: 4) {
                        if locationManager.isRunning {
                            if locationManager.isPaused {
                                Text("PAUSED")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.orange)
                            } else {
                                Text("LIVE")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.cyan)
                            }
                        } else {
                            Text(locationManager.gpsStatus.displayText)
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(locationManager.gpsStatus.color)
                        }
                        
                        // GPS accuracy indicator
                        if let accuracy = locationManager.gpsAccuracy, locationManager.isRunning && !locationManager.isPaused {
                            Image(systemName: accuracy < 10 ? "location.fill" : accuracy < 20 ? "location" : "location.slash")
                                .font(.system(size: 8))
                                .foregroundColor(accuracy < 10 ? .green : accuracy < 20 ? .orange : .red)
                        }
                    }
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
                
                // FORM RECOMMENDATION BANNER
                if locationManager.isRunning, let rec = formCoach.currentRecommendation {
                    HStack(spacing: 6) {
                        Image(systemName: iconForType(rec.type))
                            .font(.system(size: 10))
                            .foregroundColor(colorForType(rec.type))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(rec.message)
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.white)
                            Text(rec.detail)
                                .font(.system(size: 8))
                                .foregroundColor(.gray)
                        }
                        Spacer()
                    }
                    .padding(6)
                    .background(backgroundColorForType(rec.type))
                    .cornerRadius(6)
                    .padding(.horizontal)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                
                // CONTROL BUTTONS
                if locationManager.isRunning {
                    HStack(spacing: 12) {
                        // Pause/Resume Button
                        Button(action: {
                            if locationManager.isPaused {
                                locationManager.resume()
                            } else {
                                locationManager.pause()
                            }
                            #if os(watchOS)
                            WKInterfaceDevice.current().play(.click)
                            #endif
                        }) {
                            Image(systemName: locationManager.isPaused ? "play.fill" : "pause.fill")
                        }
                        .accessibilityLabel(locationManager.isPaused ? "Resume Run" : "Pause Run")
                        .background(locationManager.isPaused ? Color.green : Color.orange)
                        .clipShape(Circle())
                        
                        // Stop Button
                        Button(action: {
                            if let summary = locationManager.toggleTracking(targetNPI: targetNPI) {
                                // Validate run before saving
                                if locationManager.shouldSaveRun() {
                                    let run = Run(
                                        date: summary.date,
                                        distance: summary.distance,
                                        duration: summary.duration,
                                        avgPace: summary.avgPace,
                                        avgNPI: summary.avgNPI,
                                        avgHeartRate: summary.avgHeartRate,
                                        routeData: summary.routeData
                                    )
                                    modelContext.insert(run)
                                } else {
                                    showInvalidRunAlert = true
                                }
                            }
                        }) {
                            Image(systemName: "stop.fill")
                        }
                        .accessibilityLabel("Stop and Save Run")
                        .background(Color.red)
                        .clipShape(Circle())
                    }
                    .padding(.bottom, 5)
                } else {
                    // Start Button
                    Button(action: {
                        _ = locationManager.toggleTracking(targetNPI: targetNPI)
                        #if os(watchOS)
                        WKInterfaceDevice.current().play(.click)
                        #endif
                    }) {
                        Image(systemName: "play.fill")
                    }
                    .accessibilityLabel("Start Run")
                    .background(Color.green)
                    .clipShape(Circle())
                    .padding(.bottom, 5)
                }
            }
        }
    }
    
    // MARK: - Form Coach Helpers
    private func startFormEvaluation() {
        // Initial evaluation
        formCoach.evaluate(metrics: locationManager.currentFormMetrics)
        
        // Timer for periodic evaluation (every 5 seconds)
        formTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { _ in
            formCoach.evaluate(metrics: locationManager.currentFormMetrics)
        }
    }
    
    private func stopFormEvaluation() {
        formTimer?.invalidate()
        formTimer = nil
        formCoach.currentRecommendation = nil
    }
    
    private func iconForType(_ type: RecommendationType) -> String {
        switch type {
        case .good: return "checkmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .alert: return "exclamationmark.circle.fill"
        }
    }
    
    private func colorForType(_ type: RecommendationType) -> Color {
        switch type {
        case .good: return .green
        case .warning: return .orange
        case .alert: return .red
        }
    }
    
    private func backgroundColorForType(_ type: RecommendationType) -> Color {
        switch type {
        case .good: return Color.green.opacity(0.15)
        case .warning: return Color.orange.opacity(0.15)
        case .alert: return Color.red.opacity(0.15)
        }
    }
}

