import SwiftUI
import CoreLocation
import SwiftData
import AVFoundation

// MARK: - CONFIGURATION
// ⚠️ GET A KEY AT: https://aistudio.google.com/
let GEMINI_API_KEY = "PASTE_KEY_HERE"

// MARK: - MAIN CONTENT VIEW
struct ContentView: View {
    @StateObject private var locationManager = LocationManager()
    @StateObject private var aiCoach = AICoach()
    
    // Persistent Settings
    @AppStorage("targetNPI") private var targetNPI: Double = 135.0
    @AppStorage("unitSystem") private var unitSystem: String = "metric"
    @AppStorage("physioMode") private var physioMode: Bool = false
    
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            
            // PAGE 1: RUN DASHBOARD
            RunView(locationManager: locationManager, aiCoach: aiCoach, targetNPI: targetNPI, unitSystem: unitSystem, physioMode: physioMode)
                .tag(0)
            
            // PAGE 2: SETTINGS
            SettingsView(targetNPI: $targetNPI, unitSystem: $unitSystem, physioMode: $physioMode)
                .tag(1)
            
            // PAGE 3: HISTORY
            HistoryView(unitSystem: unitSystem)
                .tag(2)
            
            // PAGE 4: USER MANUAL
            ManualView()
                .tag(3)
        }
        .tabViewStyle(.verticalPage)
    }
}

// MARK: - PAGE 1: RUN VIEW
struct RunView: View {
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
                Button(action: { locationManager.toggleTracking(targetNPI: targetNPI) }) {
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
                WKInterfaceDevice.current().play(.success)
                // S.O.S Haptic Pattern
                let device = WKInterfaceDevice.current()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { device.play(.click) }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { device.play(.click) }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { device.play(.click) }
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
        .sheet(isPresented: $aiCoach.isAnalyzing) { VStack { ProgressView("Analyzing...") } }
        .sheet(item: $aiCoach.result) { res in
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

// MARK: - VISUALS
struct ScreenOutline: View {
    let current: Double; let target: Double
    var body: some View {
        GeometryReader { geo in
            let p = min(max(current/target, 0), 1.0)
            ZStack {
                RoundedRectangle(cornerRadius: 40, style: .continuous).stroke(Color.gray.opacity(0.3), lineWidth: 6)
                RoundedRectangle(cornerRadius: 40, style: .continuous).trim(from: 0, to: CGFloat(p)).stroke(p >= 1.0 ? Color.green : Color.cyan, style: StrokeStyle(lineWidth: 6, lineCap: .round)).rotationEffect(.degrees(-90)).animation(.linear, value: p)
            }.edgesIgnoringSafeArea(.all)
        }
    }
}

struct RunnerTrack: View {
    let current: Double; let target: Double
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let pct = min(max(current/target, 0), 1.05)
            let x = w * CGFloat(pct)
            ZStack(alignment: .leading) {
                Capsule().fill(Color.gray.opacity(0.3)).frame(height: 4)
                Capsule().fill(Color.cyan).frame(width: x, height: 4)
                Text("🏃").font(.system(size: 16)).position(x: x, y: geo.size.height/2).animation(.linear, value: x).scaleEffect(x: -1, y: 1)
                Text("🏁").font(.system(size: 12)).position(x: w, y: geo.size.height/2)
            }
        }
    }
}

struct FireworksView: View {
    var body: some View { ZStack { Color.black.opacity(0.3); Text("🎉").font(.largeTitle) } }
}

struct StatBox: View {
    let title: String; let value: String; let color: Color
    var body: some View { VStack { Text(title).font(.system(size: 8, weight: .bold)).foregroundColor(.gray); Text(value).font(.system(size: 14, design: .monospaced)).foregroundColor(color) }.frame(maxWidth: .infinity).background(Color.gray.opacity(0.1)).cornerRadius(5) }
}

// MARK: - PAGE 2: SETTINGS
struct SettingsView: View {
    @Binding var targetNPI: Double; @Binding var unitSystem: String; @Binding var physioMode: Bool
    var body: some View {
        List {
            Section(header: Text("GOALS")) {
                VStack(alignment: .leading) {
                    Text("TARGET NPI").font(.caption).foregroundColor(.gray)
                    Stepper(value: $targetNPI, in: 50...200, step: 5) {
                        Text("\(Int(targetNPI))").font(.title3).bold().foregroundColor(.cyan)
                    }
                }
                Toggle("Physio-Pacer", isOn: $physioMode)
            }
            Section(header: Text("SYSTEM")) { Picker("Units", selection: $unitSystem) { Text("Metric").tag("metric"); Text("Imperial").tag("imperial") } }
        }
    }
}

// MARK: - PAGE 3: HISTORY
struct HistoryView: View {
    let unitSystem: String
    var body: some View { List { Text("No runs recorded.").foregroundColor(.gray) } }
}

// MARK: - PAGE 4: MANUAL
struct ManualView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 15) {
                HStack { Image(systemName: "book.fill").foregroundColor(.cyan); Text("USER MANUAL").font(.headline).bold() }.padding(.bottom, 5)
                ManualCard(icon: "waveform.path.ecg", color: .cyan, title: "WHAT IS NPI?", desc: "Normalized Performance Index. Speed adjusted for fatigue.")
                ManualCard(icon: "flag.fill", color: .orange, title: "DYNAMIC FINISH", desc: "The time shown is how long to beat your Target if you hold current pace.")
                ManualCard(icon: "heart.fill", color: .red, title: "PHYSIO-PACER", desc: "Detects cardiac drift. If HR spikes while pace is flat, suggests recovery speed.")
                Text("v1.0 • Kinetix Labs").font(.footnote).foregroundColor(.gray).frame(maxWidth: .infinity).padding(.top, 20)
            }
        }
    }
}

struct ManualCard: View {
    let icon: String; let color: Color; let title: String; let desc: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack { Image(systemName: icon).font(.caption).foregroundColor(color); Text(title).font(.caption).fontWeight(.black).foregroundColor(.white) }
            Text(desc).font(.system(size: 10)).foregroundColor(.gray)
        }.padding(10).background(Color.gray.opacity(0.15)).cornerRadius(10).overlay(RoundedRectangle(cornerRadius: 10).stroke(color.opacity(0.5), lineWidth: 1))
    }
}

// MARK: - LOGIC ENGINE
class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    @Published var isRunning = false
    @Published var liveNPI: Double = 0.0
    @Published var totalDistance: Double = 0.0
    @Published var paceSeconds: Double = 0.0
    @Published var timeToBeat: String? = nil
    @Published var heartRate: Double = 70.0
    @Published var recommendedPace: Double = 0.0
    
    private var lastLocation: CLLocation?
    private var timer: Timer?
    private var duration: TimeInterval = 0
    private var activeTargetNPI: Double = 135.0
    
    // Rolling Pace Buffer
    private var rollingDistances: [(Date, Double)] = [] // (Timestamp, DistanceDelta)
    @Published var currentPaceSeconds: Double = 0.0
    
    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.requestWhenInUseAuthorization()
    }
    
    func toggleTracking(targetNPI: Double) {
        self.activeTargetNPI = targetNPI
        isRunning ? stop() : start()
    }
    
    private func start() {
        isRunning = true; totalDistance = 0; liveNPI = 0; duration = 0
        manager.startUpdatingLocation()
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
            self.duration += 0.1
            self.heartRate = 140 + (Double(self.duration) * 0.1) // Sim HR
            self.updateCalculations()
        }
    }
    
    private func stop() { isRunning = false; manager.stopUpdatingLocation(); timer?.invalidate() }
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last, isRunning else { return }
        
        // Filter poor GPS data
        if loc.horizontalAccuracy < 0 || loc.horizontalAccuracy > 50 { return }
        
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

// MARK: - GEMINI AI COACH
class AICoach: ObservableObject {
    @Published var isAnalyzing = false
    @Published var result: AIResult?
    struct AIResult: Codable, Identifiable { var id = UUID(); let title: String; let insight: String }
    
    func analyzeRun(distance: Double, pace: String, npi: Double, pb: Double) {
        guard !GEMINI_API_KEY.contains("PASTE") else { return }
        isAnalyzing = true
        let prompt = "You are Kinetix AI. Analyze: Dist \(distance)km, Pace \(pace), NPI \(Int(npi)), Target \(Int(pb)). JSON: { \"title\": \"Scientific Title\", \"insight\": \"Feedback\" }"
        let url = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=\(GEMINI_API_KEY)")!
        var req = URLRequest(url: url); req.httpMethod = "POST"; req.addValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = ["contents": [["parts": [["text": prompt]]]], "generationConfig": ["responseMimeType": "application/json"]]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: req) { d, _, _ in DispatchQueue.main.async { self.isAnalyzing = false; if let d=d, let r=try? JSONDecoder().decode(GeminiResponse.self, from: d), let t=r.candidates.first?.content.parts.first?.text.data(using:.utf8), let res=try? JSONDecoder().decode(AIResult.self, from: t) { self.result = res } } }.resume()
    }
}
struct GeminiResponse: Codable { let candidates: [Candidate] }; struct Candidate: Codable { let content: Content }; struct Content: Codable { let parts: [Part] }; struct Part: Codable { let text: String }
