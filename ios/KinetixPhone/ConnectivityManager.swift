import Foundation
import WatchConnectivity
import Combine
import SwiftData

class ConnectivityManager: NSObject, ObservableObject, WCSessionDelegate {
    @Published var currentMetrics: FormMetrics = FormMetrics()
    @Published var isWatchConnected: Bool = false
    @Published var connectionStatusMessage: String = "Initializing..."
    @Published var lastUpdate: Date? = nil
    @Published var lastActivitySync: Date? = nil
    
    // Run State
    @Published var isRunActive: Bool = false
    
    // History Buffer for Charts (Last 60 points)
    @Published var heartRateHistory: [(Date, Double)] = []
    @Published var cadenceHistory: [(Date, Double)] = []
    
    // Alerts
    let alertSubject = PassthroughSubject<String, Never>()
    
    static let shared = ConnectivityManager()
    
    weak var modelContext: ModelContext?
    private var connectionCheckTimer: Timer?
    
    override private init() {
        super.init()
        setupSession()
    }
    
    func bind(modelContext: ModelContext) {
        self.modelContext = modelContext
    }
    
    func checkForRunState() {
        let session = WCSession.default
        checkApplicationContextForRunState(session: session)
    }
    
    func setupSession() {
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
            
            // Check application context immediately for run state
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self.checkApplicationContextForRunState(session: session)
            }
            
            // Periodically check connection status and application context
            // Interval increased to 10s to reduce background overhead
            connectionCheckTimer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { [weak self] _ in
                DispatchQueue.main.async {
                    self?.updateConnectionStatus(session: session)
                    self?.checkApplicationContextForRunState(session: session)
                }
            }
        }
    }
    
    // MARK: - WCSessionDelegate
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            // Update connection status based on actual connectivity
            self.updateConnectionStatus(session: session)
        }
    }
    
    func sessionDidBecomeInactive(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isWatchConnected = false
        }
    }
    
    func sessionDidDeactivate(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isWatchConnected = false
        }
        session.activate() // Reactivate if needed
    }
    
    // Receive real-time message from Watch
    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        DispatchQueue.main.async {
            // Update connection status - receiving messages means watch is connected
            self.updateConnectionStatus(session: session)
            
            if let request = message["requestActivities"] as? Bool, request {
                self.pushActivitiesToWatch()
                return
            }
            
            if let data = message["activities"] as? Data {
                self.storeIncomingActivities(data)
                return
            }
            
            if let sampleData = message["formSamples"] as? Data {
                self.storeIncomingFormSamples(sampleData)
                return
            }
            
            if let runData = message["run"] as? Data {
                self.storeIncomingRun(runData)
                return
            }
            
            // Check for run state changes
            if let isRunning = message["isRunning"] as? Bool {
                print("📱 iPhone received run state: \(isRunning)")
                if self.isRunActive != isRunning {
                    DiagnosticLogManager.shared.log("Received run state in message: \(isRunning)", category: "connectivity")
                    self.isRunActive = isRunning
                }
            }
            
            self.parseMetrics(message)
            self.lastUpdate = Date()
        }
    }
    
    // Receive background info (context update)
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        DispatchQueue.main.async {
            print("📱 iPhone: Received application context: \(applicationContext.keys)")
            
            // Update connection status
            self.updateConnectionStatus(session: session)
            
            // Process ALL keys independently, not mutually exclusive
            if let data = applicationContext["activities"] as? Data {
                self.storeIncomingActivities(data)
            }
            
            if let sampleData = applicationContext["formSamples"] as? Data {
                self.storeIncomingFormSamples(sampleData)
            }
            
            if let runData = applicationContext["run"] as? Data {
                self.storeIncomingRun(runData)
            }
            
            if let isRunning = applicationContext["isRunning"] as? Bool {
                print("📱 iPhone received run state (context): \(isRunning)")
                if self.isRunActive != isRunning {
                    let msg = "Received run state in context update: \(isRunning)"
                    DiagnosticLogManager.shared.log(msg, category: "connectivity")
                    self.isRunActive = isRunning
                }
            }
            
            // Parse metrics if present (and not just run state)
            if applicationContext["heartRate"] != nil || applicationContext["pace"] != nil {
                self.parseMetrics(applicationContext)
                self.lastUpdate = Date()
            }
        }
    }
    
    // MARK: - Connection Status
    
    private func updateConnectionStatus(session: WCSession) {
        // Log status for debugging
        let timeSinceStr = lastUpdate.map { String(format: "%.1fs ago", Date().timeIntervalSince($0)) } ?? "never"
        let statusMsg = "Check: Reachable=\(session.isReachable), Paired=\(session.isPaired), AppInstalled=\(session.isWatchAppInstalled), State=\(session.activationState.rawValue)"
        print("📱 \(statusMsg)")
        
        // 1. Basic Session State
        guard session.activationState == .activated else {
            isWatchConnected = false
            connectionStatusMessage = "Session Not Active (\(session.activationState.rawValue))"
            return
        }
        
        guard session.isPaired else {
            isWatchConnected = false
            connectionStatusMessage = "No Watch Paired"
            return
        }
        
        guard session.isWatchAppInstalled else {
            isWatchConnected = false
            connectionStatusMessage = "Watch App Not Installed"
            return
        }
        
        // 2. Connectivity
        if session.isReachable {
            isWatchConnected = true
            connectionStatusMessage = "Connected (Reachable)"
            return
        }
        
        // 3. Recent Activity Fallback
        if let lastUpdate = lastUpdate {
            let timeSinceLastUpdate = Date().timeIntervalSince(lastUpdate)
            if timeSinceLastUpdate < 30.0 {
                isWatchConnected = true
                connectionStatusMessage = "Connected (Active \(Int(timeSinceLastUpdate))s ago)"
                return
            }
        }
        
        // 4. Default State: Paired but not reachable
        isWatchConnected = false
        connectionStatusMessage = "Paired (Not Reachable)"
        
        // Log this specific state to diagnostics only occasionally to avoid spam
        if Int(Date().timeIntervalSince1970) % 10 == 0 {
             DiagnosticLogManager.shared.log("Watch paired but not reachable. Last update: \(timeSinceStr)", category: "connectivity")
        }
    }
    
    func checkApplicationContextForRunState(session: WCSession) {
        guard session.activationState == .activated else { return }
        
        let context = session.receivedApplicationContext
        // Log context keys periodically to debug what's stuck in there
        if !context.isEmpty {
             // print("📱 iPhone: Current Application Context Keys: \(context.keys)")
        }
        
        if let isRunning = context["isRunning"] as? Bool {
            // Only log if state mismatch to avoid spam
            if self.isRunActive != isRunning {
                let msg = "Found run state in application context: \(isRunning) (Current: \(self.isRunActive))"
                print("📱 iPhone: \(msg)")
                DiagnosticLogManager.shared.log(msg, category: "connectivity")
                DispatchQueue.main.async {
                    self.isRunActive = isRunning
                }
            }
        }
    }
    
    private func parseMetrics(_ data: [String: Any]) {
        // Check for alerts first
        if let alert = data["alert"] as? String {
            alertSubject.send(alert)
            return
        }
        
        // Map dictionary back to FormMetrics
        if let cad = data["cadence"] as? Double { 
            currentMetrics.cadence = cad 
            cadenceHistory.append((Date(), cad))
            if cadenceHistory.count > 60 { cadenceHistory.removeFirst() }
        }
        if let osc = data["verticalOscillation"] as? Double { currentMetrics.verticalOscillation = osc }
        if let gct = data["groundContactTime"] as? Double { currentMetrics.groundContactTime = gct }
        if let hr = data["heartRate"] as? Double { 
            currentMetrics.heartRate = hr 
            heartRateHistory.append((Date(), hr))
            if heartRateHistory.count > 60 { heartRateHistory.removeFirst() }
        }
        if let pace = data["pace"] as? Double { currentMetrics.pace = pace }
        if let dist = data["distance"] as? Double { currentMetrics.distance = dist }
    }
    
    // MARK: - Activity Sync
    func syncActivitiesFromBuilder(_ activities: [ActivityTemplate]) {
        let payloads = activities.map { $0.toPayload() }
        sendActivitiesPayload(payloads)
    }
    
    // MARK: - Battery Profile Sync
    func syncBatteryProfiles() {
        guard let ctx = modelContext else { return }
        if let profiles = try? ctx.fetch(FetchDescriptor<CustomBatteryProfile>()) {
            let payloads = profiles.map { $0.toPayload() }
            sendBatteryProfilesPayload(payloads)
        }
    }
    
    private func sendBatteryProfilesPayload(_ payloads: [BatteryProfilePayload]) {
        guard let data = try? JSONEncoder().encode(payloads) else { return }
        let session = WCSession.default
        if session.isReachable {
            session.sendMessage(["batteryProfiles": data], replyHandler: nil)
        } else {
            DiagnosticLogManager.shared.log("Watch not reachable during battery profile sync", category: "sync")
        }
        do {
            var context = session.applicationContext
            context["batteryProfiles"] = data
            try session.updateApplicationContext(context)
        } catch {
            DiagnosticLogManager.shared.log("Failed to push battery profiles: \(error.localizedDescription)", category: "sync")
        }
    }
    
    private func pushActivitiesToWatch() {
        guard let ctx = modelContext else { return }
        if let templates = try? ctx.fetch(FetchDescriptor<ActivityTemplate>()) {
            syncActivitiesFromBuilder(templates)
        }
    }
    
    private func sendActivitiesPayload(_ payloads: [ActivityPayload]) {
        guard let data = try? JSONEncoder().encode(payloads) else { return }
        let session = WCSession.default
        if session.isReachable {
            session.sendMessage(["activities": data], replyHandler: nil)
        } else {
            DiagnosticLogManager.shared.log("Watch not reachable during activity sync", category: "sync")
        }
        do {
            var context = session.applicationContext
            context["activities"] = data
            try session.updateApplicationContext(context)
        } catch {
            DiagnosticLogManager.shared.log("Failed to push activities: \(error.localizedDescription)", category: "sync")
        }
        lastActivitySync = Date()
    }
    
    private func storeIncomingActivities(_ data: Data) {
        guard let modelContext else { return }
        do {
            let payloads = try JSONDecoder().decode([ActivityPayload].self, from: data)
            for payload in payloads {
                upsertActivity(payload, context: modelContext)
            }
            lastActivitySync = Date()
        } catch {
            DiagnosticLogManager.shared.log("Failed to decode incoming activities: \(error.localizedDescription)", category: "sync")
        }
    }
    
    private func upsertActivity(_ payload: ActivityPayload, context: ModelContext) {
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
    
    private func storeIncomingFormSamples(_ data: Data) {
        guard let modelContext else { return }
        do {
            let payloads = try JSONDecoder().decode([FormMonitorSamplePayload].self, from: data)
            for payload in payloads {
                let descriptor = FetchDescriptor<FormMonitorSample>(predicate: #Predicate { $0.id == payload.id })
                if let existing = try? modelContext.fetch(descriptor).first {
                    existing.bubbleX = payload.bubbleX
                    existing.bubbleY = payload.bubbleY
                    existing.instability = payload.instability
                    existing.symmetry = payload.symmetry
                    existing.cadence = payload.cadence
                    existing.verticalOscillation = payload.verticalOscillation
                    existing.strideLength = payload.strideLength
                    existing.groundContactTime = payload.groundContactTime
                    existing.pace = payload.pace
                    existing.leftRightBalance = payload.leftRightBalance
                    existing.rollingPace = payload.rollingPace
                } else {
                    let sample = FormMonitorSample(
                        id: payload.id,
                        sessionId: payload.sessionId,
                        timestamp: payload.timestamp,
                        bubbleX: payload.bubbleX,
                        bubbleY: payload.bubbleY,
                        instability: payload.instability,
                        symmetry: payload.symmetry,
                        cadence: payload.cadence,
                        verticalOscillation: payload.verticalOscillation,
                        strideLength: payload.strideLength,
                        groundContactTime: payload.groundContactTime,
                        pace: payload.pace,
                        leftRightBalance: payload.leftRightBalance,
                        rollingPace: payload.rollingPace
                    )
                    modelContext.insert(sample)
                }
            }
        } catch {
            DiagnosticLogManager.shared.log("Failed to decode form samples: \(error.localizedDescription)", category: "sync")
        }
    }
    
    private func storeIncomingRun(_ data: Data) {
        guard let modelContext else { return }
        do {
            let payload = try JSONDecoder().decode(RunPayload.self, from: data)
            
            // Validate NPI before saving
            let finalNPI: Double
            if RunMetricsCalculator.isValidNPI(payload.avgNPI) {
                finalNPI = payload.avgNPI
            } else if RunMetricsCalculator.isValidRunForNPI(
                distanceMeters: payload.distance,
                durationSeconds: payload.duration
            ) {
                // Recalculate NPI if current value is invalid
                finalNPI = RunMetricsCalculator.calculateNPI(
                    distanceMeters: payload.distance,
                    durationSeconds: payload.duration
                )
                
                if !RunMetricsCalculator.isValidNPI(finalNPI) {
                    print("⚠️ iPhone: Received run with invalid KPS, recalculated value also invalid. Skipping save.")
                    DiagnosticLogManager.shared.log("Received run with invalid KPS from Watch", category: "sync")
                    return
                }
            } else {
                print("⚠️ iPhone: Received run with invalid data. Skipping save.")
                DiagnosticLogManager.shared.log("Received run with invalid data from Watch", category: "sync")
                return
            }
            
            // Check if run already exists
            let descriptor = FetchDescriptor<Run>(predicate: #Predicate { $0.id == payload.id })
            if (try? modelContext.fetch(descriptor).first) == nil {
                // Create new run from payload with validated NPI
                let run = Run(
                    date: payload.date,
                    source: payload.source,
                    distance: payload.distance,
                    duration: payload.duration,
                    avgPace: payload.avgPace,
                    avgNPI: finalNPI,
                    avgHeartRate: payload.avgHeartRate,
                    avgCadence: payload.avgCadence,
                    avgVerticalOscillation: payload.avgVerticalOscillation,
                    avgGroundContactTime: payload.avgGroundContactTime,
                    avgStrideLength: payload.avgStrideLength,
                    formScore: payload.formScore,
                    routeData: payload.routeData,
                    formSessionId: payload.formSessionId
                )
                modelContext.insert(run)
                print("📱 iPhone: Received and saved run from Watch: \(String(format: "%.2f", payload.distance / 1000)) km, KPS: \(Int(finalNPI))")
            }
        } catch {
            DiagnosticLogManager.shared.log("Failed to decode incoming run: \(error.localizedDescription)", category: "sync")
        }
    }
}
