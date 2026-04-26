import SwiftUI
import SwiftData
import CoreLocation

struct RunTrackingView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    
    @StateObject private var gpsManager = GPSManager()
    @StateObject private var healthKitManager = HealthKitManager()
    
    @State private var isRunning = false
    @State private var isPaused = false
    @State private var startTime: Date?
    @State private var pausedDuration: TimeInterval = 0
    @State private var lastPauseTime: Date?
    
    @State private var totalDistance: Double = 0 // meters
    @State private var lastLocation: CLLocation?
    @State private var distanceSamples: [DistanceSample] = []
    @State private var heartRateSamples: [(Date, Double)] = []
    
    @AppStorage("livePaceRollingWindowSeconds") private var livePaceRollingWindowSeconds: Double = LivePaceCalculator.defaultRollingWindowSeconds
    @State private var livePace: Double = 0 // seconds per km
    @State private var averagePace: Double = 0 // seconds per km
    @State private var currentNPI: Double = 0
    @State private var timerTick: Int = 0
    
    @State private var updateTimer: Timer?
    
    var body: some View {
        ZStack {
            // Background Gradient
            LinearGradient(
                colors: [Color(white: 0.05), Color(white: 0.15)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                // Status Bar
                HStack {
                    HStack(spacing: 6) {
                        Image(systemName: gpsStatusIcon)
                            .foregroundColor(gpsStatusColor)
                            .font(.system(size: 14, weight: .bold))
                        Text(gpsStatusText)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white.opacity(0.7))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.05))
                    .cornerRadius(20)

                    Spacer()

                    Button {
                        if !isRunning { dismiss() }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 24))
                            .foregroundColor(.white.opacity(0.3))
                    }
                    .opacity(isRunning ? 0 : 1)
                }
                .padding()
                
                Spacer()

                // Primary Metrics (High Information Density for iPhone 17 Pro Max)
                VStack(spacing: 40) {
                    // Time
                    VStack(spacing: 8) {
                        Text("ELAPSED TIME")
                            .font(.system(size: 12, weight: .black))
                            .tracking(2)
                            .foregroundColor(.cyan)
                        Text(formatTime(elapsedTime))
                            .font(.system(size: 84, weight: .black, design: .rounded))
                            .foregroundColor(.white)
                            .monospacedDigit()
                    }
                    
                    // KPS - The Star Metric
                    VStack(spacing: 12) {
                        Text("PERFORMANCE SCORE")
                            .font(.system(size: 14, weight: .black))
                            .tracking(3)
                            .foregroundColor(.cyan)
                        
                        ZStack {
                            Circle()
                                .stroke(Color.white.opacity(0.1), lineWidth: 4)
                                .frame(width: 180, height: 180)

                            Circle()
                                .trim(from: 0, to: CGFloat(min(currentNPI / 200.0, 1.0)))
                                .stroke(
                                    LinearGradient(colors: [.cyan, .blue], startPoint: .top, endPoint: .bottom),
                                    style: StrokeStyle(lineWidth: 12, lineCap: .round)
                                )
                                .frame(width: 180, height: 180)
                                .rotationEffect(.degrees(-90))

                            VStack(spacing: -4) {
                                Text(String(format: "%.1f", currentNPI))
                                    .font(.system(size: 64, weight: .black, design: .rounded))
                                    .foregroundColor(.white)
                                Text("KPS")
                                    .font(.system(size: 18, weight: .black))
                                    .foregroundColor(.cyan)
                            }
                        }
                    }

                    // Secondary Metrics Row
                    HStack(spacing: 0) {
                        MetricBox(label: "DISTANCE", value: String(format: "%.2f", totalDistance / 1000.0), unit: "KM")
                        Divider().background(Color.white.opacity(0.1)).frame(height: 40).padding(.horizontal)
                        MetricBox(label: "LIVE PACE", value: RunMetricsCalculator.formatPace(livePace), unit: "/KM")
                        Divider().background(Color.white.opacity(0.1)).frame(height: 40).padding(.horizontal)
                        MetricBox(label: "HEART RATE", value: heartRate > 0 ? "\(Int(heartRate))" : "--", unit: "BPM")
                    }
                    .padding()
                    .background(Color.white.opacity(0.05))
                    .cornerRadius(24)
                }
                
                Spacer()
                
                // Control Hub
                HStack(spacing: 24) {
                    if !isRunning {
                        Button {
                            startRun()
                        } label: {
                            CircleButton(icon: "play.fill", label: "START", color: .green)
                        }
                    } else {
                        if isPaused {
                            Button {
                                stopRun()
                            } label: {
                                CircleButton(icon: "stop.fill", label: "STOP", color: .red)
                            }

                            Button {
                                resumeRun()
                            } label: {
                                CircleButton(icon: "play.fill", label: "RESUME", color: .green)
                            }
                        } else {
                            Button {
                                pauseRun()
                            } label: {
                                CircleButton(icon: "pause.fill", label: "PAUSE", color: .orange)
                            }
                        }
                    }
                }
                .padding(.bottom, 40)
            }
        }
        .statusBarHidden()
        .onAppear {
            gpsManager.requestAuthorization()
            healthKitManager.requestAuthorization()
        }
        .onDisappear {
            updateTimer?.invalidate()
        }
    }

    // MARK: - Components

    struct MetricBox: View {
        let label: String
        let value: String
        let unit: String

        var body: some View {
            VStack(spacing: 4) {
                Text(label)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.white.opacity(0.5))
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(value)
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Text(unit)
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(.cyan)
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    struct CircleButton: View {
        let icon: String
        let label: String
        let color: Color

        var body: some View {
            VStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(color.opacity(0.15))
                        .frame(width: 80, height: 80)
                    Circle()
                        .stroke(color.opacity(0.3), lineWidth: 2)
                        .frame(width: 80, height: 80)
                    Image(systemName: icon)
                        .font(.system(size: 32, weight: .bold))
                        .foregroundColor(color)
                }
                Text(label)
                    .font(.system(size: 12, weight: .black))
                    .foregroundColor(color)
            }
        }
    }
    
    // MARK: - Computed Properties
    
    private var elapsedTime: TimeInterval {
        guard let startTime = startTime else { return 0 }
        let totalTime = Date().timeIntervalSince(startTime)
        var totalPausedTime = pausedDuration
        if isPaused, let pauseTime = lastPauseTime {
            totalPausedTime += Date().timeIntervalSince(pauseTime)
        }
        return totalTime - totalPausedTime
    }
    
    private var heartRate: Double { healthKitManager.heartRate }
    
    private var gpsStatusIcon: String {
        switch gpsManager.status {
        case .excellent, .good: return "location.fill"
        case .poor: return "location"
        case .searching: return "location.circle"
        case .denied: return "location.slash"
        case .failed: return "exclamationmark.triangle"
        case .unknown: return "questionmark.circle"
        }
    }
    
    private var gpsStatusColor: Color {
        switch gpsManager.status {
        case .excellent: return .green
        case .good: return .blue
        case .poor: return .orange
        case .searching: return .yellow
        case .denied, .failed: return .red
        case .unknown: return .gray
        }
    }
    
    private var gpsStatusText: String {
        switch gpsManager.status {
        case .excellent: return "GPS EXCELLENT"
        case .good: return "GPS GOOD"
        case .poor: return "GPS POOR"
        case .searching: return "SEARCHING..."
        case .denied: return "DENIED"
        case .failed: return "ERROR"
        case .unknown: return "UNKNOWN"
        }
    }
    
    // MARK: - Run Control
    
    private func startRun() {
        totalDistance = 0
        lastLocation = nil
        distanceSamples = []
        heartRateSamples = []
        livePace = 0
        averagePace = 0
        currentNPI = 0
        startTime = Date()
        pausedDuration = 0
        isRunning = true
        isPaused = false
        gpsManager.startTracking()
        healthKitManager.startWorkout()
        gpsManager.onLocationUpdate = { handleLocationUpdate($0) }
        healthKitManager.onHeartRateUpdate = { heartRateSamples.append((Date(), $0)) }
        updateTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            DispatchQueue.main.async {
                timerTick += 1
                updateMetrics()
            }
        }
    }
    
    private func pauseRun() {
        isPaused = true
        lastPauseTime = Date()
        lastLocation = nil
        gpsManager.stopTracking()
        healthKitManager.stopWorkout()
    }
    
    private func resumeRun() {
        if let pauseTime = lastPauseTime {
            pausedDuration += Date().timeIntervalSince(pauseTime)
        }
        isPaused = false
        lastPauseTime = nil
        lastLocation = nil
        gpsManager.startTracking()
        healthKitManager.startWorkout()
    }
    
    private func stopRun() {
        updateTimer?.invalidate()
        gpsManager.stopTracking()
        healthKitManager.stopWorkout()
        Task { await saveRun() }
        isRunning = false
        isPaused = false
        dismiss()
    }
    
    // MARK: - Location & Metrics
    
    private func handleLocationUpdate(_ location: CLLocation) {
        guard isRunning && !isPaused else { return }
        if location.horizontalAccuracy < 0 || location.horizontalAccuracy > 50 { return }
        if let last = lastLocation {
            let dist = gpsManager.calculateDistance(from: last, to: location)
            let timeDiff = location.timestamp.timeIntervalSince(last.timestamp)
            if timeDiff > 0 && (dist / timeDiff) < 12.0 {
                totalDistance += dist
                distanceSamples.append(DistanceSample(timestamp: location.timestamp, totalDistanceMeters: totalDistance))
                pruneDistanceSamples()
            }
        } else {
            distanceSamples.append(DistanceSample(timestamp: location.timestamp, totalDistanceMeters: totalDistance))
            pruneDistanceSamples()
        }
        lastLocation = location
    }
    
    private func updateMetrics() {
        guard isRunning && !isPaused else { return }
        let duration = elapsedTime
        if totalDistance > 0 && duration > 0 {
            averagePace = duration / (totalDistance / 1000.0)
            livePace = LivePaceCalculator.rollingPace(from: distanceSamples, windowSeconds: max(1, livePaceRollingWindowSeconds), now: Date())
            if totalDistance > 100 && duration > 30 {
                let calculatedNPI = RunMetricsCalculator.calculateNPI(distanceMeters: totalDistance, durationSeconds: duration)
                if RunMetricsCalculator.isValidNPI(calculatedNPI) { currentNPI = calculatedNPI }
            }
        }
    }
    
    private func saveRun() async {
        guard elapsedTime > 0 else { return }
        let distanceToSave = totalDistance > 0 ? totalDistance : 0.0
        let avgHeartRate = heartRateSamples.isEmpty ? 0.0 : heartRateSamples.map { $0.1 }.reduce(0, +) / Double(heartRateSamples.count)
        let avgPace = distanceToSave > 0 ? (averagePace > 0 ? averagePace : elapsedTime / (distanceToSave / 1000.0)) : 0.0
        let avgNPI = distanceToSave > 0 ? RunMetricsCalculator.calculateNPI(distanceMeters: distanceToSave, durationSeconds: elapsedTime) : 0.0
        
        let run = Run(
            date: startTime ?? Date(),
            source: "iphone",
            distance: distanceToSave,
            duration: elapsedTime,
            avgPace: avgPace,
            avgNPI: avgNPI,
            avgHeartRate: avgHeartRate,
            routeData: gpsManager.routeCoordinates
        )
        
        do {
            try await UnifiedStorageService.shared.saveRun(run, modelContext: modelContext)
        } catch {
            print("Failed to save run: \(error)")
        }
    }
    
    private func formatTime(_ seconds: TimeInterval) -> String { return RunMetricsCalculator.formatTime(seconds) }
    private func pruneDistanceSamples() {
        let keepSeconds = max(30.0, max(1, livePaceRollingWindowSeconds) * 6.0)
        let cutoff = Date().addingTimeInterval(-keepSeconds)
        distanceSamples.removeAll { $0.timestamp < cutoff }
    }
}
