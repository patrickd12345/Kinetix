import Foundation
import WatchConnectivity
import Combine
import SwiftData

class ConnectivityManager: NSObject, ObservableObject, WCSessionDelegate {
    @Published var currentMetrics: FormMetrics = FormMetrics()
    @Published var isWatchConnected: Bool = false
    @Published var lastUpdate: Date = Date()
    @Published var lastActivitySync: Date? = nil
    
    // History Buffer for Charts (Last 60 points)
    @Published var heartRateHistory: [(Date, Double)] = []
    @Published var cadenceHistory: [(Date, Double)] = []
    
    // Alerts
    let alertSubject = PassthroughSubject<String, Never>()
    
    static let shared = ConnectivityManager()
    
    weak var modelContext: ModelContext?
    
    override private init() {
        super.init()
        setupSession()
    }
    
    func bind(modelContext: ModelContext) {
        self.modelContext = modelContext
    }
    
    func setupSession() {
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }
    }
    
    // MARK: - WCSessionDelegate
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isWatchConnected = (activationState == .activated) && session.isReachable
        }
    }
    
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) {
        session.activate() // Reactivate if needed
    }
    
    // Receive real-time message from Watch
    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        DispatchQueue.main.async {
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
            
            self.parseMetrics(message)
            self.lastUpdate = Date()
        }
    }
    
    // Receive background info (context update)
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        DispatchQueue.main.async {
            if let data = applicationContext["activities"] as? Data {
                self.storeIncomingActivities(data)
            } else if let sampleData = applicationContext["formSamples"] as? Data {
                self.storeIncomingFormSamples(sampleData)
            } else {
                self.parseMetrics(applicationContext)
                self.lastUpdate = Date()
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
}
