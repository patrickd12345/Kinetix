import Foundation
import CoreLocation
import Combine
import HealthKit
import SwiftData
import SwiftUI
import WatchConnectivity

// MARK: - Supporting Types (moved from LocationManager)
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

struct RaceReadinessInputsPayload: Codable {
    let fatigueLevel: String?
    let loadRiskLevel: String?
    let predictionDirection: String?
    let periodizationPhase: String?
    let daysRemaining: Int?
    let recommendedWorkout: String?
    let lastComputedAt: Date?
}

struct RaceReadinessSnapshot: Codable {
    let score: Int
    let status: String
    let message: String
    let recommendedWorkout: String?
    let lastComputedAt: Date?
}

enum RaceReadinessEngine {
    static func compute(from payload: RaceReadinessInputsPayload) throws -> RaceReadinessSnapshot {
        guard let phase = payload.periodizationPhase else {
            throw NSError(domain: "RaceReadiness", code: 1, userInfo: [NSLocalizedDescriptionKey: "Not enough recent data"])
        }
        let score = clamp(
            scoreFatigue(payload.fatigueLevel) +
                scoreLoadRisk(payload.loadRiskLevel) +
                scorePredictionTrend(payload.predictionDirection) +
                scorePhaseAlignment(daysRemaining: payload.daysRemaining, phase: phase) +
                scoreGoalProximity(daysRemaining: payload.daysRemaining, baseWithoutGoal: baseWithoutGoal(payload: payload, phase: phase)),
            min: 0,
            max: 100
        )

        return RaceReadinessSnapshot(
            score: score,
            status: mapWatchStatus(score),
            message: buildWatchMessage(score),
            recommendedWorkout: payload.recommendedWorkout,
            lastComputedAt: payload.lastComputedAt
        )
    }

    private static func baseWithoutGoal(payload: RaceReadinessInputsPayload, phase: String) -> Int {
        scoreFatigue(payload.fatigueLevel) +
            scoreLoadRisk(payload.loadRiskLevel) +
            scorePredictionTrend(payload.predictionDirection) +
            scorePhaseAlignment(daysRemaining: payload.daysRemaining, phase: phase)
    }

    private static func clamp(_ value: Int, min: Int, max: Int) -> Int {
        Swift.min(max, Swift.max(min, value))
    }

    private static func scoreFatigue(_ level: String?) -> Int {
        if level == "high" { return 4 }
        if level == "moderate" { return 14 }
        if level == "low" { return 26 }
        return 12
    }

    private static func scoreLoadRisk(_ risk: String?) -> Int {
        if risk == "high" { return 3 }
        if risk == "moderate" { return 10 }
        if risk == "low" { return 18 }
        return 8
    }

    private static func scorePredictionTrend(_ direction: String?) -> Int {
        if direction == "improving" { return 18 }
        if direction == "stable" { return 11 }
        if direction == "declining" { return 4 }
        return 8
    }

    private static func scorePhaseAlignment(daysRemaining: Int?, phase: String) -> Int {
        if daysRemaining == nil {
            if phase == "build" { return 10 }
            if phase == "base" { return 8 }
            if phase == "peak" { return 11 }
            if phase == "taper" { return 9 }
        }

        if let daysRemaining, daysRemaining <= 21 && (phase == "taper" || phase == "peak") { return 14 }
        if let daysRemaining, daysRemaining <= 42 && phase == "build" { return 10 }
        if phase == "base" { return 7 }
        return 9
    }

    private static func scoreGoalProximity(daysRemaining: Int?, baseWithoutGoal: Int) -> Int {
        guard let daysRemaining else { return 7 }
        if daysRemaining > 56 { return 7 }
        if daysRemaining > 21 { return 10 }
        if baseWithoutGoal < 55 { return 2 }
        if baseWithoutGoal < 70 { return 6 }
        return 12
    }

    private static func mapWatchStatus(_ score: Int) -> String {
        if score >= 70 { return "high" }
        if score >= 50 { return "moderate" }
        return "low"
    }

    private static func buildWatchMessage(_ score: Int) -> String {
        if score >= 70 { return "Ready for quality work today" }
        if score >= 50 { return "Solid day to train, keep effort controlled" }
        return "Prioritize recovery before hard work"
    }
}

// MARK: - Refactored LocationManager
/// Coordinates GPS, HealthKit, run state, and metrics calculation
class LocationManager: NSObject, ObservableObject, WCSessionDelegate {
    // MARK: - Managers
    private let gpsManager = GPSManager()
    private let healthKitManager = HealthKitManager()
    private let runStateManager = RunStateManager()
    
    // MARK: - Watch Connectivity
    private var session: WCSession?
    private weak var modelContext: ModelContext?
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Published State (for UI)
    @Published var isRunning: Bool = false
    @Published var isPaused: Bool = false
    @Published var liveNPI: Double = 0.0
    @Published var totalDistance: Double = 0.0
    @Published var paceSeconds: Double = 0.0
    @Published var timeToBeat: String? = nil
    @Published var heartRate: Double = 0.0
    @Published var recommendedPace: Double = 0.0
    @Published var latestSyncedWeightKg: Double = UserDefaults.standard.double(forKey: "lastWithingsWeightKg")
    @Published var latestSyncedWeightUpdatedAt: Date? = {
        let ts = UserDefaults.standard.double(forKey: "lastWithingsWeightSyncedAt")
        guard ts > 0 else { return nil }
        return Date(timeIntervalSince1970: ts)
    }()
    @Published var raceReadinessSnapshot: RaceReadinessSnapshot?
    @Published var raceReadinessError: String?
    
    // GPS Status (delegated to GPSManager)
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
    
    // Presets & Battery
    @Published var currentPreset: WorkoutPreset?
    @Published var batteryManager = BatteryManager()
    
    // Progress Gauge
    @Published var runProgress: Double = 0.0
    private var rolling5SecPace: Double = 0.0
    private var rollingPaceBuffer: [(Date, Double)] = []
    
    // Internal state
    private var lastLocation: CLLocation?
    private var timer: Timer?
    private var saveTimer: Timer?
    private var gpsMonitorTimer: Timer?
    private var activeTargetNPI: Double = 135.0
    
    // Data buffering
    private var rollingDistances: [(Date, Double)] = []
    @Published var currentPaceSeconds: Double = 0.0
    private var heartRateSamples: [Double] = []
    
    var isFormMonitorActivity: Bool {
        currentPreset?.type == .formMonitor || activeActivityTemplate?.goal == .formMonitor
    }
    
    // MARK: - Initialization
    
    override init() {
        super.init()
        setupManagers()
        currentPreset = WorkoutPreset.builtInPresets().first
        gpsManager.requestAuthorization()
        healthKitManager.requestAuthorization()
        _ = checkForRecovery()
        setupConnectivity()
    }
    
    private func setupManagers() {
        // GPS Manager callbacks
        gpsManager.onLocationUpdate = { [weak self] location in
            self?.handleLocationUpdate(location)
        }
        gpsManager.onStatusChange = { [weak self] status in
            DispatchQueue.main.async {
                self?.gpsStatus = status
                self?.gpsAccuracy = self?.gpsManager.accuracy
                self?.lastGPSUpdate = self?.gpsManager.lastUpdate
                self?.gpsError = self?.gpsManager.error
            }
        }
        
        // HealthKit Manager callbacks
        healthKitManager.onHeartRateUpdate = { [weak self] hr in
            DispatchQueue.main.async {
                self?.heartRate = hr
                self?.currentFormMetrics.heartRate = hr
                if hr > 0 {
                    self?.heartRateSamples.append(hr)
                }
            }
        }
        
        healthKitManager.onFormMetricsUpdate = { [weak self] metrics in
            DispatchQueue.main.async {
                // Update form metrics from HealthKit
                if let osc = metrics.verticalOscillation {
                    self?.currentFormMetrics.verticalOscillation = osc
                }
                if let stride = metrics.strideLength {
                    self?.currentFormMetrics.strideLength = stride
                }
                if let gct = metrics.groundContactTime {
                    self?.currentFormMetrics.groundContactTime = gct
                }
            }
        }
        
        // Observe HealthKit errors
        healthKitManager.$error
            .receive(on: DispatchQueue.main)
            .assign(to: &$healthKitError)
        
        // Observe run state
        runStateManager.$isRunning
            .receive(on: DispatchQueue.main)
            .sink { [weak self] newValue in
                self?.isRunning = newValue
                // Notify iPhone when run state changes
                self?.notifyPhoneRunStateChanged(isRunning: newValue)
            }
            .store(in: &cancellables)
        
        runStateManager.$isPaused
            .receive(on: DispatchQueue.main)
            .assign(to: &$isPaused)
    }
    
    func bind(modelContext: ModelContext) {
        self.modelContext = modelContext
        batteryManager.bind(modelContext: modelContext)
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
        // Session activated - resend state if needed
        DispatchQueue.main.async {
            print("⌚️ Watch: Session activated (State: \(activationState.rawValue))")
            // Ensure iPhone has latest run state upon activation
            self.notifyPhoneRunStateChanged(isRunning: self.isRunning)
            self.requestLatestWithingsWeightSync()
        }
    }
    
    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        if let data = message["activities"] as? Data {
            handleIncomingActivities(data)
        }
        if let data = message["batteryProfiles"] as? Data {
            handleIncomingBatteryProfiles(data)
        }
        if let rawWeight = message["withingsWeightKg"] {
            handleIncomingWithingsWeight(rawWeight, syncedAt: message["withingsWeightSyncedAt"])
        }
        handleIncomingRaceReadiness(message)
    }
    
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        if let data = applicationContext["activities"] as? Data {
            handleIncomingActivities(data)
        }
        if let data = applicationContext["batteryProfiles"] as? Data {
            handleIncomingBatteryProfiles(data)
        }
        if let rawWeight = applicationContext["withingsWeightKg"] {
            handleIncomingWithingsWeight(rawWeight, syncedAt: applicationContext["withingsWeightSyncedAt"])
        }
        handleIncomingRaceReadiness(applicationContext)
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
    
    private func notifyPhoneRunStateChanged(isRunning: Bool) {
        guard let session = session else {
            print("⌚️ Watch: No session available to notify iPhone")
            return
        }
        
        // If session isn't activated yet, we can't send reliably.
        // However, we've added a check in activationDidComplete to resend this.
        if session.activationState != .activated {
            print("⌚️ Watch: Session not activated yet (state: \(session.activationState.rawValue)). Will retry upon activation.")
            return
        }
        
        print("⌚️ Watch: Notifying iPhone of run state change: \(isRunning)")
        
        // 1. Update Application Context (Background/Async) - High Reliability
        // This is the "source of truth" the iPhone checks on wake
        do {
            var context = session.applicationContext
            context["isRunning"] = isRunning
            try session.updateApplicationContext(context)
            print("⌚️ Watch: Updated application context with run state")
        } catch {
            print("⌚️ Watch: Failed to update run state context: \(error.localizedDescription)")
        }
        
        // 2. Send Interactive Message (Foreground) - Instant UI Switch
        // We use a high-priority message (sendMessage) if reachable.
        if session.isReachable {
            print("⌚️ Watch: Sending immediate message (reachable)")
            session.sendMessage(["isRunning": isRunning], replyHandler: nil) { error in
                print("⌚️ Watch: Error sending message: \(error.localizedDescription)")
            }
        } else {
            print("⌚️ Watch: Session not reachable (iPhone likely backgrounded/locked). Relying on ApplicationContext.")
            
            // Optional: TransferUserInfo as a fallback? 
            // No, updateApplicationContext is better for "current state". 
            // UserInfo is a queue, Context is "latest state".
        }
    }
    
    func requestActivitySync() {
        guard let session = session, session.isReachable else { return }
        session.sendMessage(["requestActivities": true], replyHandler: nil)
    }

    func requestLatestWithingsWeightSync() {
        guard let session = session, session.isReachable else { return }
        session.sendMessage(["requestWithingsWeight": true], replyHandler: nil)
    }

    func requestRaceReadinessSync() {
        guard let session = session, session.isReachable else { return }
        session.sendMessage(["requestRaceReadiness": true], replyHandler: nil)
    }

    private func handleIncomingRaceReadiness(_ payload: [String: Any]) {
        if let directData = payload["raceReadiness"] as? Data {
            decodeReadinessSnapshot(data: directData)
            return
        }
        if let inputsData = payload["raceReadinessInputs"] as? Data {
            decodeAndComputeReadiness(data: inputsData)
            return
        }
    }

    private func decodeReadinessSnapshot(data: Data) {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        do {
            let snapshot = try decoder.decode(RaceReadinessSnapshot.self, from: data)
            DispatchQueue.main.async {
                self.raceReadinessSnapshot = snapshot
                self.raceReadinessError = nil
            }
        } catch {
            DispatchQueue.main.async {
                self.raceReadinessError = "Unable to compute race readiness"
            }
        }
    }

    private func decodeAndComputeReadiness(data: Data) {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        do {
            let inputs = try decoder.decode(RaceReadinessInputsPayload.self, from: data)
            let snapshot = try RaceReadinessEngine.compute(from: inputs)
            DispatchQueue.main.async {
                self.raceReadinessSnapshot = snapshot
                self.raceReadinessError = nil
            }
        } catch {
            DispatchQueue.main.async {
                self.raceReadinessSnapshot = nil
                self.raceReadinessError = error.localizedDescription
            }
        }
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
    
    private func handleIncomingBatteryProfiles(_ data: Data) {
        guard let modelContext else { return }
        do {
            let payloads = try JSONDecoder().decode([BatteryProfilePayload].self, from: data)
            for payload in payloads {
                upsertBatteryProfile(from: payload, context: modelContext)
            }
        } catch {
            print("Failed to decode battery profiles: \(error.localizedDescription)")
        }
    }

    private func handleIncomingWithingsWeight(_ value: Any, syncedAt: Any?) {
        guard let parsedKg = parseDouble(value) else { return }
        let timestamp = parseDouble(syncedAt) ?? Date().timeIntervalSince1970
        DispatchQueue.main.async {
            self.latestSyncedWeightKg = parsedKg
            self.latestSyncedWeightUpdatedAt = timestamp > 0 ? Date(timeIntervalSince1970: timestamp) : nil
            UserDefaults.standard.set(parsedKg, forKey: "lastWithingsWeightKg")
            UserDefaults.standard.set(timestamp, forKey: "lastWithingsWeightSyncedAt")
        }
    }

    private func parseDouble(_ value: Any?) -> Double? {
        if let d = value as? Double { return d }
        if let i = value as? Int { return Double(i) }
        if let n = value as? NSNumber { return n.doubleValue }
        if let s = value as? String { return Double(s) }
        return nil
    }
    
    private func upsertBatteryProfile(from payload: BatteryProfilePayload, context: ModelContext) {
        let descriptor = FetchDescriptor<CustomBatteryProfile>(predicate: #Predicate { $0.id == payload.id })
        if let existing = try? context.fetch(descriptor).first {
            existing.name = payload.name
            existing.gpsInterval = payload.gpsInterval
            existing.motionSensorInterval = payload.motionSensorInterval
            existing.formAnalysisInterval = payload.formAnalysisInterval
            existing.saveInterval = payload.saveInterval
            existing.allowHaptics = payload.allowHaptics
            existing.allowVoice = payload.allowVoice
            existing.allowLiveCharts = payload.allowLiveCharts
            existing.lastModified = payload.lastModified
        } else {
            let profile = CustomBatteryProfile(
                id: payload.id,
                name: payload.name,
                gpsInterval: payload.gpsInterval,
                motionSensorInterval: payload.motionSensorInterval,
                formAnalysisInterval: payload.formAnalysisInterval,
                saveInterval: payload.saveInterval,
                allowHaptics: payload.allowHaptics,
                allowVoice: payload.allowVoice,
                allowLiveCharts: payload.allowLiveCharts,
                isCustom: payload.isCustom
            )
            context.insert(profile)
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
            "distance": totalDistance,
            "isRunning": isRunning
        ]
        
        session.sendMessage(data, replyHandler: nil) { error in
            print("Error sending metrics: \(error.localizedDescription)")
        }
        
        // Also update application context for background delivery
        do {
            var context = session.applicationContext
            context["isRunning"] = isRunning
            try session.updateApplicationContext(context)
        } catch {
            print("Failed to update run state context: \(error.localizedDescription)")
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
    
    // MARK: - Run Control
    
    func toggleTracking(targetNPI: Double) -> RunSummary? {
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
        runStateManager.pause()
        timer?.invalidate()
        saveCurrentRun()
    }
    
    func resume() {
        guard isRunning && isPaused else { return }
        runStateManager.resume()
        
        // Resume timer
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            self.updateCalculations()
        }
    }
    
    private func start() {
        // Reset state
        totalDistance = 0
        liveNPI = 0
        paceSeconds = 0
        rollingDistances.removeAll()
        heartRateSamples.removeAll()
        currentPaceSeconds = 0
        formSessionId = isFormMonitorActivity ? UUID() : nil
        runProgress = 0.0
        rollingPaceBuffer.removeAll()
        lastLocation = nil
        timeToBeat = nil
        recommendedPace = 0
        heartRate = 0
        
        // Clear errors
        gpsError = nil
        workoutError = nil
        
        // Check GPS
        gpsManager.checkAuthorization()
        if gpsStatus == .denied {
            gpsError = "Location access required to track runs"
            return
        }
        
        // Start managers
        runStateManager.start()
        healthKitManager.startWorkout()
        gpsManager.startTracking()
        gpsManager.reset()
        
        // Start timers
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            if !self.isPaused {
                self.updateCalculations()
                if self.batteryManager.activeSettings.allowLiveCharts {
                    self.sendMetricsToPhone()
                }
            }
        }
        
        let saveInterval = batteryManager.activeSettings.saveInterval
        saveTimer = Timer.scheduledTimer(withTimeInterval: saveInterval, repeats: true) { _ in
            if self.isRunning && !self.isPaused {
                self.saveCurrentRun()
            }
        }
        
        gpsMonitorTimer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { _ in
            if self.isRunning && !self.isPaused {
                self.checkGPSSignal()
            }
        }
        
        saveCurrentRun()
    }
    
    public func stop() -> RunSummary {
        let summary = createRunSummary()
        runStateManager.stop()
        gpsManager.stopTracking()
        healthKitManager.stopWorkout()
        timer?.invalidate()
        saveTimer?.invalidate()
        gpsMonitorTimer?.invalidate()
        clearRecoveryData()
        syncFormMonitorSamplesIfNeeded()
        formSessionId = nil
        
        return summary
    }
    
    private func checkGPSSignal() {
        if let lastUpdate = gpsManager.lastUpdate {
            let timeSinceUpdate = Date().timeIntervalSince(lastUpdate)
            if timeSinceUpdate > 30 {
                DispatchQueue.main.async {
                    self.gpsStatus = .failed
                    self.gpsError = "GPS signal lost. Distance tracking may be inaccurate."
                }
            }
        } else if isRunning {
            DispatchQueue.main.async {
                self.gpsStatus = .searching
            }
        }
    }
    
    // MARK: - Location Handling
    
    private func handleLocationUpdate(_ location: CLLocation) {
        guard isRunning && !isPaused else { return }
        
        // Filter poor GPS data
        if location.horizontalAccuracy < 0 || location.horizontalAccuracy > 50 {
            if gpsStatus != .poor {
                gpsStatus = .poor
            }
            return
        }
        
        // Calculate distance
        if let last = lastLocation {
            let dist = gpsManager.calculateDistance(from: last, to: location)
            let timeDiff = location.timestamp.timeIntervalSince(last.timestamp)
            
            // Filter unrealistic jumps (e.g. > 12m/s)
            if timeDiff > 0 && (dist / timeDiff) < 12.0 {
                totalDistance += dist
                rollingDistances.append((Date(), dist))
            }
        }
        lastLocation = location
        
        // Prune buffer
        let now = Date()
        rollingDistances = rollingDistances.filter { now.timeIntervalSince($0.0) < 10 }
    }
    
    // MARK: - Recovery
    
    private func saveCurrentRun() {
        guard isRunning, let startTime = runStateManager.runStartTime else { return }
        
        let recovery = RunRecoveryData(
            startTime: startTime,
            distance: totalDistance,
            duration: runStateManager.elapsedDuration(),
            routeData: gpsManager.routeCoordinates,
            heartRateSamples: heartRateSamples,
            targetNPI: activeTargetNPI
        )
        
        runStateManager.saveRecoveryData(recovery)
    }
    
    func clearRecoveryData() {
        runStateManager.clearRecovery()
    }
    
    func checkForRecovery() -> RunRecoveryData? {
        return runStateManager.checkForRecovery()
    }
    
    func recoverRun(_ recovery: RunRecoveryData) {
        totalDistance = recovery.distance
        heartRateSamples = recovery.heartRateSamples
        activeTargetNPI = recovery.targetNPI
        
        // Restore last location
        if let lastPoint = recovery.routeData.last {
            lastLocation = CLLocation(latitude: lastPoint.lat, longitude: lastPoint.lon)
        }
        
        // Restore route in GPS manager
        gpsManager.routeCoordinates = recovery.routeData
        
        // Resume state
        runStateManager.recoverRun(recovery)
        gpsManager.startTracking()
        healthKitManager.startWorkout()
        
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            if !self.isPaused {
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
    }
    
    // MARK: - Run Summary
    
    private func createRunSummary() -> RunSummary {
        let avgHR = heartRateSamples.isEmpty ? 0.0 : heartRateSamples.reduce(0, +) / Double(heartRateSamples.count)
        let activeDuration = runStateManager.elapsedDuration()
        let avgPace = totalDistance > 0 ? activeDuration / (totalDistance / 1000.0) : 0.0
        
        // Ensure NPI is valid, recalculate if needed
        var finalNPI = liveNPI
        if !RunMetricsCalculator.isValidNPI(finalNPI) && RunMetricsCalculator.isValidRunForNPI(
            distanceMeters: totalDistance,
            durationSeconds: activeDuration
        ) {
            // Recalculate NPI if current value is invalid
            finalNPI = RunMetricsCalculator.calculateNPI(
                distanceMeters: totalDistance,
                durationSeconds: activeDuration
            )
        }
        
        // Fallback to 0 if still invalid (shouldn't happen if shouldSaveRun() was called)
        if !RunMetricsCalculator.isValidNPI(finalNPI) {
            finalNPI = 0
        }
        
        return RunSummary(
            distance: totalDistance,
            duration: activeDuration,
            avgPace: avgPace,
            avgNPI: finalNPI,
            avgHeartRate: avgHR,
            avgCadence: currentFormMetrics.cadence,
            avgVerticalOscillation: currentFormMetrics.verticalOscillation,
            avgGroundContactTime: currentFormMetrics.groundContactTime,
            avgStrideLength: currentFormMetrics.strideLength,
            formScore: currentFormMetrics.formScore,
            date: runStateManager.runStartTime ?? Date(),
            routeData: gpsManager.routeCoordinates,
            formSessionId: formSessionId
        )
    }
    
    func shouldSaveRun() -> Bool {
        let duration = runStateManager.elapsedDuration()
        let hasMinimumDistance = totalDistance >= 100
        let hasMinimumDuration = duration >= 10
        
        // Validate that we can calculate a valid NPI
        let canCalculateNPI = RunMetricsCalculator.isValidRunForNPI(
            distanceMeters: totalDistance,
            durationSeconds: duration
        )
        
        // If we have a calculated NPI, validate it
        let hasValidNPI = RunMetricsCalculator.isValidNPI(liveNPI)
        
        return hasMinimumDistance && hasMinimumDuration && canCalculateNPI && hasValidNPI
    }
    
    // MARK: - Metrics Calculation
    
    func updateCalculations() {
        let duration = runStateManager.elapsedDuration()

        timeToBeat = nil

        if totalDistance > 0 {
            // Overall Avg Pace (for NPI)
            paceSeconds = duration / (totalDistance / 1000.0)
            
            // Calculate Rolling Pace (Last 10s) for Display
            let rollingDist = rollingDistances.map { $0.1 }.reduce(0, +)
            if !rollingDistances.isEmpty && rollingDist > 0 {
                if let first = rollingDistances.first {
                    let window = Date().timeIntervalSince(first.0)
                    if window > 0 {
                        currentPaceSeconds = window / (rollingDist / 1000.0)
                    }
                }
            } else {
                currentPaceSeconds = paceSeconds
            }
            
            recommendedPace = currentPaceSeconds + 30.0
            
            // Fallback cadence calculation
            if currentFormMetrics.cadence == nil && currentPaceSeconds > 0 {
                let estimatedStride = 1.2
                let speedMS = 1000.0 / currentPaceSeconds
                let estimatedCadence = (speedMS / estimatedStride) * 60.0
                currentFormMetrics.cadence = estimatedCadence
            }
            
            currentFormMetrics.pace = currentPaceSeconds
            currentFormMetrics.distance = totalDistance
            if currentFormMetrics.leftRightBalance == nil {
                currentFormMetrics.leftRightBalance = 50
            }
            
            // Update 5-sec rolling buffer for Progress
            let now = Date()
            rollingPaceBuffer.append((now, currentPaceSeconds))
            rollingPaceBuffer = rollingPaceBuffer.filter { now.timeIntervalSince($0.0) <= 5.0 }
            
            let avg5SecPace = rollingPaceBuffer.isEmpty ? paceSeconds : rollingPaceBuffer.map(\.1).reduce(0, +) / Double(rollingPaceBuffer.count)
            rolling5SecPace = avg5SecPace
            
            // NPI Calculation
            if totalDistance > 100 && duration > 30 {
                // Use the validated calculateNPI function
                let calculatedNPI = RunMetricsCalculator.calculateNPI(
                    distanceMeters: totalDistance,
                    durationSeconds: duration
                )
                
                // Only update liveNPI if calculation is valid
                if RunMetricsCalculator.isValidNPI(calculatedNPI) {
                    liveNPI = calculatedNPI
                    
                    let targetDistance = 5000.0
                    if let projection = RunMetricsCalculator.projectRaceTime(
                        currentNPI: liveNPI,
                        goalNPI: activeTargetNPI,
                        elapsedSeconds: duration,
                        distanceCoveredMeters: totalDistance,
                        targetDistanceMeters: targetDistance
                    ) {
                        runProgress = projection.progress
                        timeToBeat = projection.displayString(includeGoal: activeTargetNPI > 0)
                    }
                } else {
                    // Invalid NPI - keep previous value or set to 0
                    if !RunMetricsCalculator.isValidNPI(liveNPI) {
                        liveNPI = 0
                    }
                }
            }
        }
    }
    
    // MARK: - Formatting Helpers
    
    func formattedPace(unit: String) -> String {
        if currentPaceSeconds.isInfinite || currentPaceSeconds.isNaN { return "0:00" }
        let pace = unit == "metric" ? currentPaceSeconds : currentPaceSeconds * 1.60934
        if pace.isInfinite || pace.isNaN || pace > 359999 { return "0:00" }
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
