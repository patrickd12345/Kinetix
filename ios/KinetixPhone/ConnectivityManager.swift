import Foundation
import WatchConnectivity
import Combine

class ConnectivityManager: NSObject, ObservableObject, WCSessionDelegate {
    @Published var currentMetrics: FormMetrics = FormMetrics()
    @Published var isWatchConnected: Bool = false
    @Published var lastUpdate: Date = Date()
    
    // History Buffer for Charts (Last 60 points)
    @Published var heartRateHistory: [(Date, Double)] = []
    @Published var cadenceHistory: [(Date, Double)] = []
    
    // Alerts
    let alertSubject = PassthroughSubject<String, Never>()
    
    static let shared = ConnectivityManager()
    
    override private init() {
        super.init()
        setupSession()
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
            self.parseMetrics(message)
            self.lastUpdate = Date()
        }
    }
    
    // Receive background info (context update)
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        DispatchQueue.main.async {
            self.parseMetrics(applicationContext)
            self.lastUpdate = Date()
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
}

