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
    @State private var heartRateSamples: [(Date, Double)] = []
    
    @State private var currentPace: Double = 0 // seconds per km
    @State private var currentNPI: Double = 0
    @State private var timerTick: Int = 0 // Force UI refresh every second
    
    @State private var updateTimer: Timer?
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                // GPS Status
                HStack {
                    Image(systemName: gpsStatusIcon)
                        .foregroundColor(gpsStatusColor)
                    Text(gpsStatusText)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color(UIColor.secondarySystemBackground))
                .cornerRadius(8)
                
                // Main Metrics
                VStack(spacing: 30) {
                    // Time
                    VStack(spacing: 8) {
                        Text("Time")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(formatTime(elapsedTime))
                            .font(.system(size: 48, weight: .bold))
                            .monospacedDigit()
                    }
                    
                    // Distance
                    VStack(spacing: 8) {
                        Text("Distance")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(String(format: "%.2f km", totalDistance / 1000.0))
                            .font(.system(size: 36, weight: .bold))
                            .monospacedDigit()
                    }
                    
                    // NPI (Star Feature!)
                    VStack(spacing: 8) {
                        Text("KPS")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(String(format: "%.1f", currentNPI))
                            .font(.system(size: 48, weight: .bold))
                            .foregroundColor(.cyan)
                            .monospacedDigit()
                    }
                    
                    // Pace & Heart Rate
                    HStack(spacing: 40) {
                        VStack(spacing: 4) {
                            Text("Pace")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(RunMetricsCalculator.formatPace(currentPace))
                                .font(.title2)
                                .fontWeight(.semibold)
                                .monospacedDigit()
                        }
                        
                        VStack(spacing: 4) {
                            Text("Heart Rate")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(heartRate > 0 ? "\(Int(heartRate))" : "--")
                                .font(.title2)
                                .fontWeight(.semibold)
                                .monospacedDigit()
                        }
                    }
                }
                .padding()
                
                Spacer()
                
                // Control Buttons
                HStack(spacing: 20) {
                    if !isRunning {
                        Button {
                            startRun()
                        } label: {
                            HStack {
                                Image(systemName: "play.fill")
                                Text("Start")
                            }
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.green)
                            .cornerRadius(12)
                        }
                    } else {
                        if isPaused {
                            Button {
                                resumeRun()
                            } label: {
                                HStack {
                                    Image(systemName: "play.fill")
                                    Text("Resume")
                                }
                                .font(.headline)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.green)
                                .cornerRadius(12)
                            }
                        } else {
                            Button {
                                pauseRun()
                            } label: {
                                HStack {
                                    Image(systemName: "pause.fill")
                                    Text("Pause")
                                }
                                .font(.headline)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.orange)
                                .cornerRadius(12)
                            }
                        }
                        
                        Button {
                            stopRun()
                        } label: {
                            HStack {
                                Image(systemName: "stop.fill")
                                Text("Stop")
                            }
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.red)
                            .cornerRadius(12)
                        }
                    }
                }
                .padding()
            }
            .padding()
            .navigationTitle("Run Tracking")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                gpsManager.requestAuthorization()
                healthKitManager.requestAuthorization()
            }
            .onDisappear {
                updateTimer?.invalidate()
            }
        }
    }
    
    // MARK: - Computed Properties
    
    private var elapsedTime: TimeInterval {
        guard let startTime = startTime else { return 0 }
        let totalTime = Date().timeIntervalSince(startTime)
        
        // Subtract all paused time
        var totalPausedTime = pausedDuration
        
        // If currently paused, add the current pause duration
        if isPaused, let pauseTime = lastPauseTime {
            totalPausedTime += Date().timeIntervalSince(pauseTime)
        }
        
        return totalTime - totalPausedTime
    }
    
    private var heartRate: Double {
        healthKitManager.heartRate
    }
    
    private var gpsStatusIcon: String {
        switch gpsManager.status {
        case .excellent: return "location.fill"
        case .good: return "location.fill"
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
        case .excellent: return "GPS Excellent"
        case .good: return "GPS Good"
        case .poor: return "GPS Poor"
        case .searching: return "Searching for GPS..."
        case .denied: return "GPS Access Denied"
        case .failed: return "GPS Error"
        case .unknown: return "GPS Unknown"
        }
    }
    
    // MARK: - Run Control
    
    private func startRun() {
        startTime = Date()
        pausedDuration = 0
        isRunning = true
        isPaused = false
        
        gpsManager.startTracking()
        healthKitManager.startWorkout()
        
        // Setup location update handler
        gpsManager.onLocationUpdate = { location in
            handleLocationUpdate(location)
        }
        
        // Setup heart rate handler
        healthKitManager.onHeartRateUpdate = { hr in
            heartRateSamples.append((Date(), hr))
        }
        
        // Start update timer
        updateTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            DispatchQueue.main.async {
                timerTick += 1 // Force UI refresh
                updateMetrics()
            }
        }
    }
    
    private func pauseRun() {
        isPaused = true
        lastPauseTime = Date()
        gpsManager.stopTracking()
        healthKitManager.stopWorkout()
    }
    
    private func resumeRun() {
        if let pauseTime = lastPauseTime {
            pausedDuration += Date().timeIntervalSince(pauseTime)
        }
        isPaused = false
        lastPauseTime = nil
        
        gpsManager.startTracking()
        healthKitManager.startWorkout()
    }
    
    private func stopRun() {
        updateTimer?.invalidate()
        gpsManager.stopTracking()
        healthKitManager.stopWorkout()
        
        // Save run asynchronously
        Task {
            await saveRun()
        }
        
        isRunning = false
        isPaused = false
        dismiss()
    }
    
    // MARK: - Location & Metrics
    
    private func handleLocationUpdate(_ location: CLLocation) {
        guard isRunning && !isPaused else { return }
        
        // Filter poor GPS data
        if location.horizontalAccuracy < 0 || location.horizontalAccuracy > 50 {
            return
        }
        
        // Calculate distance
        if let last = lastLocation {
            let dist = gpsManager.calculateDistance(from: last, to: location)
            let timeDiff = location.timestamp.timeIntervalSince(last.timestamp)
            
            // Filter unrealistic jumps (e.g. > 12m/s)
            if timeDiff > 0 && (dist / timeDiff) < 12.0 {
                totalDistance += dist
            }
        }
        lastLocation = location
    }
    
    private func updateMetrics() {
        guard isRunning && !isPaused else { return }
        
        let duration = elapsedTime
        
        if totalDistance > 0 && duration > 0 {
            // Calculate pace (seconds per km)
            currentPace = duration / (totalDistance / 1000.0)
            
            // Calculate NPI
            if totalDistance > 100 && duration > 30 {
                let calculatedNPI = RunMetricsCalculator.calculateNPI(
                    distanceMeters: totalDistance,
                    durationSeconds: duration
                )
                
                // Only update currentNPI if calculation is valid
                if RunMetricsCalculator.isValidNPI(calculatedNPI) {
                    currentNPI = calculatedNPI
                } else {
                    // Invalid NPI - keep previous value or set to 0
                    if !RunMetricsCalculator.isValidNPI(currentNPI) {
                        currentNPI = 0
                    }
                }
            }
        }
    }
    
    private func saveRun() async {
        // Save run if there's any elapsed time (even if GPS hasn't locked yet)
        guard elapsedTime > 0 else {
            print("Run not saved: no elapsed time")
            return
        }
        
        // If no distance, still save with 0 distance (GPS might not have locked)
        let distanceToSave = totalDistance > 0 ? totalDistance : 0.0
        
        let avgHeartRate = heartRateSamples.isEmpty ? 0.0 : 
            heartRateSamples.map { $0.1 }.reduce(0, +) / Double(heartRateSamples.count)
        
        // Calculate pace - use a default if no distance
        let avgPace: Double
        if distanceToSave > 0 {
            avgPace = currentPace > 0 ? currentPace : elapsedTime / (distanceToSave / 1000.0)
        } else {
            avgPace = 0.0 // No pace if no distance
        }
        
        // Calculate NPI - only if we have distance
        let avgNPI: Double
        if distanceToSave > 0 {
            let calculatedNPI = RunMetricsCalculator.calculateNPI(
                distanceMeters: distanceToSave,
                durationSeconds: elapsedTime
            )
            
            // Validate NPI before saving
            if RunMetricsCalculator.isValidNPI(calculatedNPI) {
                avgNPI = calculatedNPI
            } else {
                // Invalid NPI - use 0 as fallback
                avgNPI = 0.0
                print("⚠️ Warning: Calculated invalid KPS for run. Distance: \(distanceToSave)m, Duration: \(elapsedTime)s")
            }
        } else {
            avgNPI = 0.0 // No NPI if no distance
        }
        
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
        
        // Save run using UnifiedStorageService (handles local save + automatic cloud sync)
        do {
            try await UnifiedStorageService.shared.saveRun(run, modelContext: modelContext)
            print("Run saved: \(distanceToSave)m in \(elapsedTime)s")
        } catch {
            print("Failed to save run: \(error)")
        }
    }
    
    private func formatTime(_ seconds: TimeInterval) -> String {
        return RunMetricsCalculator.formatTime(seconds)
    }
}

