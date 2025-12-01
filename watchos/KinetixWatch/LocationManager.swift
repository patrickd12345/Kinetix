import Foundation
import CoreLocation
import Combine
import HealthKit
import SwiftData
import SwiftUI
import WatchConnectivity

struct RunSummary {
    let distance: Double
    let duration: TimeInterval
    let avgPace: Double
    let avgNPI: Double
    let avgHeartRate: Double
    let avgCadence: Double?
    let avgVerticalOscillation: Double?
    let avgGroundContactTime: Double?
    let avgStrideLength: Double?
    let formScore: Double?
    let date: Date
    let routeData: [RoutePoint]
    let formSessionId: UUID?
}

enum GPSStatus {
    case unknown
    case searching
    case poor
    case good
    case excellent
    case denied
    case failed
    
    var displayText: String {
        switch self {
        case .unknown: return "WAITING"
        case .searching: return "SEARCHING"
        case .poor: return "POOR GPS"
        case .good: return "READY"
        case .excellent: return "READY"
        case .denied: return "GPS DENIED"
        case .failed: return "GPS FAILED"
        }
    }
    
    var color: Color {
        switch self {
        case .unknown, .searching: return .gray
        case .poor: return .orange
        case .good, .excellent: return .green
        case .denied, .failed: return .red
        }
    }
}

struct RunRecoveryData: Codable {
    let startTime: Date
    let distance: Double
    let duration: TimeInterval
    let routeData: [RoutePoint]
    let heartRateSamples: [Double]
    let targetNPI: Double
}

class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate, HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate, WCSessionDelegate {
    private let manager = CLLocationManager()
    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var session: WCSession?
    private weak var modelContext: ModelContext?
    
    @Published var isRunning = false
    @Published var isPaused = false
    @Published var liveNPI: Double = 0.0
    @Published var totalDistance: Double = 0.0
    @Published var paceSeconds: Double = 0.0
    @Published var timeToBeat: String? = nil
    @Published var heartRate: Double = 0.0
    @Published var recommendedPace: Double = 0.0
    
    // GPS Status
    @Published var gpsStatus: GPSStatus = .unknown
    @Published var gpsAccuracy: Double? = nil
    @Published var lastGPSUpdate: Date? = nil
    
    // Error Handling
    @Published var gpsError: String? = nil
    @Published var healthKitError: String? = nil
    @Published var workoutError: String? = nil
    
    // Form Metrics
    @Published var currentFormMetrics = FormMetrics()
    @Published var formSessionId: UUID? = nil
    @Published var activeActivityTemplate: ActivityTemplate?
    @Published var activeFeedbackSettings: FeedbackSettings = FeedbackSettings()
    
    // NEW: Presets & Battery
    @Published var currentPreset: WorkoutPreset?
    @Published var batteryManager = BatteryManager()
    
    // NEW: Progress Gauge
    @Published var runProgress: Double = 0.0 // 0.0 to 1.0
    private var rolling5SecPace: Double = 0.0 // For prediction
    private var rollingPaceBuffer: [(Date, Double)] = [] // 5-sec window
    
    private var lastLocation: CLLocation?
    private var timer: Timer?
    private var saveTimer: Timer? // For periodic saves
    private var gpsMonitorTimer: Timer? // Monitor GPS signal
    private var duration: TimeInterval = 0
    private var pausedDuration: TimeInterval = 0 // Time spent paused
    private var pauseStartTime: Date? = nil
    private var activeTargetNPI: Double = 135.0
    private var runStartTime: Date? = nil
    
    var isFormMonitorActivity: Bool {
        currentPreset?.type == .formMonitor || activeActivityTemplate?.goal == .formMonitor
    }
    
    // Crash Recovery
    private let userDefaults = UserDefaults.standard
    private let recoveryKey = "KinetixRunRecovery"
    
    // Data buffering
    private var rollingDistances: [(Date, Double)] = []
    @Published var currentPaceSeconds: Double = 0.0
    private var heartRateSamples: [Double] = []
    private var routeCoordinates: [RoutePoint] = []
    
    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        
        // Load default preset if none
        // (In real app, would load from storage or set in UI)
        currentPreset = WorkoutPreset.builtInPresets().first
        
        manager.requestWhenInUseAuthorization()
        requestHealthAuthorization()
        checkGPSAuthorization()
        _ = checkForRecovery()
        setupConnectivity()
    }
    
    func bind(modelContext: ModelContext) {
        self.modelContext = modelContext
    }
    
    // MARK: - Watch Connectivity
    private func setupConnectivity() {
        if WCSession.isSupported() {
            session = WCSession.default
            session?.delegate = self
            session?.activate()
        }
    }
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        // Session activated
    }
    
    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        if let data = message["activities"] as? Data {
            handleIncomingActivities(data)
        }
    }
    
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        if let data = applicationContext["activities"] as? Data {
            handleIncomingActivities(data)
        }
    }
    
    #if os(iOS)
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { session.activate() }
    #endif
    
    func sendAlertToPhone(_ message: String) {
        guard let session = session, session.isReachable else { return }
        let data: [String: Any] = ["alert": message]
        session.sendMessage(data, replyHandler: nil)
    }
    
    func requestActivitySync() {
        guard let session = session, session.isReachable else { return }
        session.sendMessage(["requestActivities": true], replyHandler: nil)
    }
    
    private func handleIncomingActivities(_ data: Data) {
        guard let modelContext else { return }
        do {
            let payloads = try JSONDecoder().decode([ActivityPayload].self, from: data)
            for payload in payloads {
                upsertActivity(from: payload, context: modelContext)
            }
        } catch {
            print("Failed to decode activities: \(error.localizedDescription)")
        }
    }
    
    private func upsertActivity(from payload: ActivityPayload, context: ModelContext) {
        let descriptor = FetchDescriptor<ActivityTemplate>(predicate: #Predicate { $0.id == payload.id })
        if let existing = try? context.fetch(descriptor).first {
            existing.name = payload.name
            existing.icon = payload.icon
            existing.primaryScreen = payload.primaryScreen
            existing.secondaryScreens = payload.secondaryScreens
            existing.feedback = payload.feedback
            existing.goal = payload.goal
            existing.defaultBatteryProfile = payload.defaultBatteryProfile
            existing.lastModified = payload.lastModified
            existing.isCustom = payload.isCustom
        } else {
            let template = ActivityTemplate(
                id: payload.id,
                name: payload.name,
                icon: payload.icon,
                primaryScreen: payload.primaryScreen,
                secondaryScreens: payload.secondaryScreens,
                feedback: payload.feedback,
                goal: payload.goal,
                defaultBatteryProfile: payload.defaultBatteryProfile,
                lastModified: payload.lastModified,
                isCustom: payload.isCustom
            )
            context.insert(template)
        }
    }
    
    private func sendMetricsToPhone() {
        guard let session = session, session.isReachable else { return }
        
        let data: [String: Any] = [
            "heartRate": heartRate,
            "cadence": currentFormMetrics.cadence ?? 0,
            "verticalOscillation": currentFormMetrics.verticalOscillation ?? 0,
            "groundContactTime": currentFormMetrics.groundContactTime ?? 0,
            "pace": currentPaceSeconds,
            "distance": totalDistance
        ]
        
        // Use sendMessage for immediate delivery if reachable
        session.sendMessage(data, replyHandler: nil) { error in
            print("Error sending metrics: \(error.localizedDescription)")
        }
    }
    
    private func syncFormMonitorSamplesIfNeeded() {
        guard let sessionId = formSessionId, let modelContext else { return }
        let descriptor = FetchDescriptor<FormMonitorSample>(
            predicate: #Predicate { $0.sessionId == sessionId },
            sortBy: [SortDescriptor(\.timestamp, order: .forward)]
        )
        
        guard let samples = try? modelContext.fetch(descriptor), !samples.isEmpty else { return }
        let payloads = samples.map { FormMonitorSamplePayload(sample: $0) }
        guard let data = try? JSONEncoder().encode(payloads) else { return }
        
        if let wcSession = session, wcSession.isReachable {
            wcSession.sendMessage(["formSamples": data], replyHandler: nil)
        }
        
        do {
            if var context = session?.applicationContext {
                context["formSamples"] = data
                try session?.updateApplicationContext(context)
            } else {
                try session?.updateApplicationContext(["formSamples": data])
            }
        } catch {
            print("Failed to push form samples: \(error.localizedDescription)")
        }
    }
    
    // MARK: - GPS Authorization
    private func checkGPSAuthorization() {
        let status = manager.authorizationStatus
        switch status {
        case .notDetermined:
            gpsStatus = .unknown
        case .denied, .restricted:
            gpsStatus = .denied
            gpsError = "Location access denied. Enable in Settings > Privacy & Security > Location Services"
        case .authorizedWhenInUse, .authorizedAlways:
            gpsStatus = .searching
        @unknown default:
            gpsStatus = .unknown
        }
    }
    
    func requestHealthAuthorization() {
        let typesToShare: Set = [
            HKQuantityType.workoutType()
        ]
        
        var typesToRead: Set<HKQuantityType> = [
            HKQuantityType.quantityType(forIdentifier: .heartRate)!,
            HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)!
        ]
        
        // Add running form metrics if available (watchOS 7+)
        if let verticalOsc = HKQuantityType.quantityType(forIdentifier: .runningVerticalOscillation) {
            typesToRead.insert(verticalOsc)
        }
        if let strideLen = HKQuantityType.quantityType(forIdentifier: .runningStrideLength) {
            typesToRead.insert(strideLen)
        }
        if let gct = HKQuantityType.quantityType(forIdentifier: .runningGroundContactTime) {
            typesToRead.insert(gct)
        }
        
        healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { [weak self] (success, error) in
            DispatchQueue.main.async {
                if !success {
                    let errorMsg = error?.localizedDescription ?? "Unknown error"
                    self?.healthKitError = "HealthKit access denied: \(errorMsg). Enable in Settings > Privacy & Security > Health"
                    print("HealthKit authorization failed: \(errorMsg)")
                } else {
                    self?.healthKitError = nil
                }
            }
        }
    }
    
    // MARK: - Preset Selection
    func setPreset(_ preset: WorkoutPreset) {
        self.currentPreset = preset
        self.activeTargetNPI = preset.targetNPI
        self.batteryManager.setProfile(preset.defaultBatteryProfile)
        self.activeActivityTemplate = nil
        self.activeFeedbackSettings = FeedbackSettings()
    }
    
    func setActivityTemplate(_ template: ActivityTemplate) {
        self.activeActivityTemplate = template
        self.currentPreset = nil
        switch template.goal {
        case .efficiency: self.activeTargetNPI = 135
        case .race: self.activeTargetNPI = 150
        case .burner: self.activeTargetNPI = 120
        case .formMonitor: self.activeTargetNPI = 0
        case .freeRun: self.activeTargetNPI = 130
        }
        self.batteryManager.setProfile(template.defaultBatteryProfile)
        self.activeFeedbackSettings = template.feedback
    }
    
    func toggleTracking(targetNPI: Double) -> RunSummary? {
        // Ignore passed targetNPI, use preset or active
        // (Or update active if preset is meBeatMe)
        if isRunning {
            if isPaused {
                resume()
                return nil
            } else {
                return stop()
            }
        } else {
            start()
            return nil
        }
    }
    
    func pause() {
        guard isRunning && !isPaused else { return }
        isPaused = true
        pauseStartTime = Date()
        timer?.invalidate()
        saveCurrentRun() // Save before pausing
    }
    
    func resume() {
        guard isRunning && isPaused else { return }
        isPaused = false
        if let pauseStart = pauseStartTime {
            pausedDuration += Date().timeIntervalSince(pauseStart)
            pauseStartTime = nil
        }
        
        // Resume timer
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            self.duration += 1.0
            self.updateCalculations()
        }
    }
    
    private func start() {
        isRunning = true
        isPaused = false
        totalDistance = 0
        liveNPI = 0
        duration = 0
        pausedDuration = 0
        rollingDistances.removeAll()
        heartRateSamples.removeAll()
        routeCoordinates.removeAll()
        currentPaceSeconds = 0
        formSessionId = isFormMonitorActivity ? UUID() : nil
        
        // Reset Progress
        runProgress = 0.0
        rollingPaceBuffer.removeAll()
        
        lastLocation = nil
        timeToBeat = nil
        recommendedPace = 0
        heartRate = 0
        runStartTime = Date()
        
        // Clear errors
        gpsError = nil
        workoutError = nil
        
        // Check GPS before starting
        checkGPSAuthorization()
        if gpsStatus == .denied {
            gpsError = "Location access required to track runs"
            isRunning = false
            return
        }
        
        startWorkout()
        manager.startUpdatingLocation()
        
        // Get sampling interval from battery profile
        _ = batteryManager.activeSettings.gpsInterval
        
        // Main Loop
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            if !self.isPaused {
                self.duration += 1.0
                // Only update calculations/UI based on battery profile? 
                // Actually UI needs 1s updates for timer, but heavy calc can be throttled.
                self.updateCalculations()
                
                // Send to phone only if enabled and profile allows live charts?
                if self.batteryManager.activeSettings.allowLiveCharts {
                    self.sendMetricsToPhone()
                }
            }
        }
        
        // Autosave Loop
        let saveInterval = batteryManager.activeSettings.saveInterval
        saveTimer = Timer.scheduledTimer(withTimeInterval: saveInterval, repeats: true) { _ in
            if self.isRunning && !self.isPaused {
                self.saveCurrentRun()
            }
        }
        
        // Monitor GPS signal (check every 10 seconds)
        gpsMonitorTimer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { _ in
            if self.isRunning && !self.isPaused {
                self.checkGPSSignal()
            }
        }
        
        // Initial save
        saveCurrentRun()
    }
    
    private func stop() -> RunSummary {
        let summary = createRunSummary()
        isRunning = false
        isPaused = false
        manager.stopUpdatingLocation()
        timer?.invalidate()
        saveTimer?.invalidate()
        gpsMonitorTimer?.invalidate()
        stopWorkout()
        clearRecoveryData()
        syncFormMonitorSamplesIfNeeded()
        formSessionId = nil
        return summary
    }
    
    private func checkGPSSignal() {
        // Check if GPS hasn't updated in 30 seconds
        if let lastUpdate = lastGPSUpdate {
            let timeSinceUpdate = Date().timeIntervalSince(lastUpdate)
            if timeSinceUpdate > 30 {
                DispatchQueue.main.async {
                    self.gpsStatus = .failed
                    self.gpsError = "GPS signal lost. Distance tracking may be inaccurate."
                }
            }
        } else if isRunning {
            // No GPS updates at all
            DispatchQueue.main.async {
                self.gpsStatus = .searching
            }
        }
    }
    
    // MARK: - Crash Recovery
    private func saveCurrentRun() {
        guard isRunning, let startTime = runStartTime else { return }
        
        let recovery = RunRecoveryData(
            startTime: startTime,
            distance: totalDistance,
            duration: duration + pausedDuration,
            routeData: routeCoordinates,
            heartRateSamples: heartRateSamples,
            targetNPI: activeTargetNPI
        )
        
        if let encoded = try? JSONEncoder().encode(recovery) {
            userDefaults.set(encoded, forKey: recoveryKey)
        }
    }
    
    func clearRecoveryData() {
        userDefaults.removeObject(forKey: recoveryKey)
    }
    
    func checkForRecovery() -> RunRecoveryData? {
        guard let data = userDefaults.data(forKey: recoveryKey),
              let recovery = try? JSONDecoder().decode(RunRecoveryData.self, from: data) else {
            return nil
        }
        
        // Check if recovery data is recent (within last hour)
        let timeSinceStart = Date().timeIntervalSince(recovery.startTime)
        if timeSinceStart > 3600 { // Older than 1 hour, discard
            clearRecoveryData()
            return nil
        }
        
        return recovery
    }
    
    func recoverRun(_ recovery: RunRecoveryData) {
        totalDistance = recovery.distance
        duration = recovery.duration
        routeCoordinates = recovery.routeData
        heartRateSamples = recovery.heartRateSamples
        activeTargetNPI = recovery.targetNPI
        runStartTime = recovery.startTime
        
        // Restore last location if we have route data
        if let lastPoint = recovery.routeData.last {
            lastLocation = CLLocation(latitude: lastPoint.lat, longitude: lastPoint.lon)
        }
        
        // Resume running state
        isRunning = true
        isPaused = false
        manager.startUpdatingLocation()
        
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            if !self.isPaused {
                self.duration += 1.0
                self.updateCalculations()
            }
        }
        
        saveTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { _ in
            if self.isRunning && !self.isPaused {
                self.saveCurrentRun()
            }
        }
        
        gpsMonitorTimer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { _ in
            if self.isRunning && !self.isPaused {
                self.checkGPSSignal()
            }
        }
        
        startWorkout()
    }
    
    private func createRunSummary() -> RunSummary {
        let avgHR = heartRateSamples.isEmpty ? 0.0 : heartRateSamples.reduce(0, +) / Double(heartRateSamples.count)
        let activeDuration = duration + pausedDuration
        let avgPace = totalDistance > 0 ? activeDuration / (totalDistance / 1000.0) : 0.0
        
        // Calculate Average Form Metrics
        // Note: In a real app, we would accumulate these samples. For now, we'll use the last known or a placeholder average if not tracked.
        // Ideally, we should track arrays of these metrics like heartRateSamples.
        // For this MVP, we will use the current metrics as a proxy for the "average" or implement proper accumulation later.
        // Let's use the current form metrics as the "average" for now to enable the report card.
        
        return RunSummary(
            distance: totalDistance,
            duration: activeDuration,
            avgPace: avgPace,
            avgNPI: liveNPI,
            avgHeartRate: avgHR,
            avgCadence: currentFormMetrics.cadence,
            avgVerticalOscillation: currentFormMetrics.verticalOscillation,
            avgGroundContactTime: currentFormMetrics.groundContactTime,
            avgStrideLength: currentFormMetrics.strideLength,
            formScore: currentFormMetrics.formScore,
            date: runStartTime ?? Date(),
            routeData: routeCoordinates,
            formSessionId: formSessionId
        )
    }
    
    // MARK: - Run Validation
    func shouldSaveRun() -> Bool {
        // Minimum thresholds: 100m distance and 10 seconds
        return totalDistance >= 100 && (duration + pausedDuration) >= 10
    }
    
    private func startWorkout() {
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .running
        configuration.locationType = .outdoor
        
        do {
            workoutSession = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
            builder = workoutSession?.associatedWorkoutBuilder()
            
            builder?.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: configuration)
            
            workoutSession?.delegate = self
            builder?.delegate = self
            
            workoutSession?.startActivity(with: Date())
            builder?.beginCollection(withStart: Date()) { (success, error) in
                if !success {
                    print("Builder beginCollection failed: \(String(describing: error))")
                }
            }
        } catch {
            print("Failed to start workout session: \(error)")
        }
    }
    
    private func stopWorkout() {
        workoutSession?.end()
        builder?.endCollection(withEnd: Date()) { (success, error) in
            self.builder?.finishWorkout { (workout, error) in
                DispatchQueue.main.async {
                    self.workoutSession = nil
                    self.builder = nil
                }
            }
        }
    }
    
    // MARK: - CLLocationManagerDelegate
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        
        // Update GPS status based on accuracy
        updateGPSStatus(accuracy: loc.horizontalAccuracy)
        lastGPSUpdate = Date()
        gpsAccuracy = loc.horizontalAccuracy
        
        guard isRunning && !isPaused else { return }
        
        // Filter poor GPS data
        if loc.horizontalAccuracy < 0 || loc.horizontalAccuracy > 50 {
            if gpsStatus != .poor {
                gpsStatus = .poor
            }
            return
        }
        
        // Store coordinate for mapping
        routeCoordinates.append(RoutePoint(lat: loc.coordinate.latitude, lon: loc.coordinate.longitude))
        
        if let last = lastLocation {
            let dist = loc.distance(from: last)
            let timeDiff = loc.timestamp.timeIntervalSince(last.timestamp)
            
            // Filter unrealistic jumps (e.g. > 12m/s)
            if timeDiff > 0 && (dist / timeDiff) < 12.0 { 
                totalDistance += dist
                
                // Add to rolling buffer
                rollingDistances.append((Date(), dist))
            }
        }
        lastLocation = loc
        
        // Prune buffer to keep last 10 seconds
        let now = Date()
        rollingDistances = rollingDistances.filter { now.timeIntervalSince($0.0) < 10 }
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        DispatchQueue.main.async {
            self.gpsStatus = .failed
            self.gpsError = "GPS error: \(error.localizedDescription)"
            print("Location manager error: \(error)")
        }
    }
    
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        checkGPSAuthorization()
    }
    
    private func updateGPSStatus(accuracy: Double) {
        if accuracy < 0 {
            gpsStatus = .failed
        } else if accuracy > 20 {
            gpsStatus = .poor
        } else if accuracy > 10 {
            gpsStatus = .good
        } else {
            gpsStatus = .excellent
        }
    }
    
    // MARK: - HKWorkoutSessionDelegate
    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {
        // Handle state changes
        if toState == .ended && isRunning {
            // Workout ended unexpectedly
            DispatchQueue.main.async {
                self.workoutError = "Workout session ended unexpectedly"
            }
        }
    }
    
    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        DispatchQueue.main.async {
            self.workoutError = "Workout session error: \(error.localizedDescription)"
            print("Workout session failed: \(error)")
        }
    }
    
    // MARK: - HKLiveWorkoutBuilderDelegate
    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType else { continue }
            guard let statistics = workoutBuilder.statistics(for: quantityType) else { continue }
            
            DispatchQueue.main.async {
                // Heart Rate
                if quantityType == HKQuantityType.quantityType(forIdentifier: .heartRate) {
                    let heartRateUnit = HKUnit.count().unitDivided(by: HKUnit.minute())
                    let hr = statistics.mostRecentQuantity()?.doubleValue(for: heartRateUnit) ?? 0
                    self.heartRate = hr
                    self.currentFormMetrics.heartRate = hr
                    if hr > 0 { self.heartRateSamples.append(hr) }
                }
                
                // Vertical Oscillation
                if quantityType == HKQuantityType.quantityType(forIdentifier: .runningVerticalOscillation) {
                    let osc = statistics.mostRecentQuantity()?.doubleValue(for: HKUnit(from: "cm"))
                    self.currentFormMetrics.verticalOscillation = osc
                }
                
                // Stride Length & Cadence Calculation
                if quantityType == HKQuantityType.quantityType(forIdentifier: .runningStrideLength) {
                    let stride = statistics.mostRecentQuantity()?.doubleValue(for: HKUnit.meter())
                    self.currentFormMetrics.strideLength = stride
                    
                    // Calculate Cadence: (Speed m/s / Stride m) * 60
                    // Speed = 1000 / paceSeconds (s/km) -> m/s
                    if let s = stride, s > 0, self.currentPaceSeconds > 0 {
                        let speedMS = 1000.0 / self.currentPaceSeconds
                        let cadence = (speedMS / s) * 60.0
                        self.currentFormMetrics.cadence = cadence
                    }
                }
                
                // Ground Contact Time
                if quantityType == HKQuantityType.quantityType(forIdentifier: .runningGroundContactTime) {
                    let gct = statistics.mostRecentQuantity()?.doubleValue(for: HKUnit(from: "ms"))
                    self.currentFormMetrics.groundContactTime = gct
                }
            }
        }
    }
    
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {
    }
    
    func updateCalculations() {
        if totalDistance > 0 {
            // Overall Avg Pace (for NPI)
            paceSeconds = duration / (totalDistance / 1000.0)
            
            // Calculate Rolling Pace (Last 10s) for Display
            let rollingDist = rollingDistances.map { $0.1 }.reduce(0, +)
            if !rollingDistances.isEmpty && rollingDist > 0 {
                // Time window is roughly from oldest point to now
                if let first = rollingDistances.first {
                    let window = Date().timeIntervalSince(first.0)
                    if window > 0 {
                        currentPaceSeconds = window / (rollingDist / 1000.0)
                    }
                }
            } else {
                currentPaceSeconds = paceSeconds // Fallback to avg
            }
            
            // Rec Pace (Current + 30s)
            recommendedPace = currentPaceSeconds + 30.0
            
            // Fallback cadence calculation if not available from HealthKit
            // Estimate cadence from pace using typical stride length (1.2m average)
            if currentFormMetrics.cadence == nil && currentPaceSeconds > 0 {
                let estimatedStride = 1.2 // meters (typical for average runner)
                let speedMS = 1000.0 / currentPaceSeconds
                let estimatedCadence = (speedMS / estimatedStride) * 60.0
                currentFormMetrics.cadence = estimatedCadence
            }
            
            // Update context metrics for comprehensive form analysis
            currentFormMetrics.pace = currentPaceSeconds
            currentFormMetrics.distance = totalDistance
            if currentFormMetrics.leftRightBalance == nil {
                currentFormMetrics.leftRightBalance = 50 // Assume balanced if not available from sensors
            }
            
            // Update 5-sec rolling buffer for Progress
            let now = Date()
            rollingPaceBuffer.append((now, currentPaceSeconds))
            rollingPaceBuffer = rollingPaceBuffer.filter { now.timeIntervalSince($0.0) <= 5.0 }
            
            let avg5SecPace = rollingPaceBuffer.isEmpty ? paceSeconds : rollingPaceBuffer.map(\.1).reduce(0, +) / Double(rollingPaceBuffer.count)
            rolling5SecPace = avg5SecPace
            
            // Calculate Progress (MeBeatMe)
            // Progress = elapsedTime / predictedTotalTime
            // Predicted Time = elapsedTime + (RemainingDist / CurrentPace)
            // Assume standard 5k if no distance set, or user's goal
            let targetDistance = 5000.0 // Default 5k for gauge
            let remainingDist = max(0, targetDistance - totalDistance)
            
            if avg5SecPace > 0 && remainingDist > 0 {
                // Pace is s/km -> s/m = pace/1000
                let pacePerMeter = avg5SecPace / 1000.0
                let timeRemaining = remainingDist * pacePerMeter
                let predictedTotal = (duration + pausedDuration) + timeRemaining
                
                if predictedTotal > 0 {
                    runProgress = (duration + pausedDuration) / predictedTotal
                }
            } else if remainingDist <= 0 {
                runProgress = 1.0 // Finished
            }
            
            // Require at least 100m distance and 30s duration for NPI to stabilize
            if totalDistance > 100 && duration > 30 {
                // NPI Formula
                let speedKmH = (1000/paceSeconds) * 3.6
                let factor = pow((totalDistance/1000.0), 0.06)
                liveNPI = speedKmH * factor * 10.0
                
                // Projection Logic (Using Avg Pace)
                let roundingThreshold = activeTargetNPI - 0.5
                let term = 10 * ((roundingThreshold * (duration/60)/(totalDistance/1000)) / 500 - 1)
                
                if term < 5 {
                    let distNeeded = exp(term) - 0.1
                    let distRemaining = distNeeded - (totalDistance/1000.0)
                    
                    if distRemaining > 0 {
                        let timeSecs = distRemaining * paceSeconds
                        let m = Int(timeSecs / 60)
                        let s = Int(timeSecs.truncatingRemainder(dividingBy: 60))
                        
                        // Format Pace for Display
                        let paceMin = Int(paceSeconds / 60)
                        let paceSec = Int(paceSeconds.truncatingRemainder(dividingBy: 60))
                        
                        timeToBeat = String(format: "%d:%02d @ AVG %d:%02d", m, s, paceMin, paceSec)
                    } else {
                        timeToBeat = "GO GO GO!"
                    }
                } else {
                    timeToBeat = "INCREASE PACE"
                }
            }
        }
    }
    
    func formattedPace(unit: String) -> String {
        // Use currentPaceSeconds (Rolling) for display instead of Avg
        if currentPaceSeconds.isInfinite || currentPaceSeconds.isNaN { return "0:00" }
        let pace = unit == "metric" ? currentPaceSeconds : currentPaceSeconds * 1.60934
        if pace.isInfinite || pace.isNaN || pace > 359999 { return "0:00" } // Guard against huge values
        return String(format: "%d:%02d", Int(pace/60), Int(pace.truncatingRemainder(dividingBy: 60)))
    }
    
    func recommendedPaceString(unit: String) -> String {
        if recommendedPace.isInfinite || recommendedPace.isNaN { return "0:00" }
        let pace = unit == "metric" ? recommendedPace : recommendedPace * 1.60934
        if pace.isInfinite || pace.isNaN || pace > 359999 { return "0:00" }
        return String(format: "%d:%02d", Int(pace/60), Int(pace.truncatingRemainder(dividingBy: 60)))
    }
    
    func formattedDistance(unit: String) -> String {
        let dist = unit == "metric" ? totalDistance/1000 : (totalDistance/1000) * 0.621371
        return String(format: "%.2f", dist)
    }
}
