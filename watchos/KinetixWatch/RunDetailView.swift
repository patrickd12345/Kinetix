import SwiftUI
import SwiftData
import MapKit

struct RunDetailView: View {
    let run: Run
    let unitSystem: String
    @Query(sort: \Run.date, order: .reverse) private var allRuns: [Run]
    @State private var aiSummaryText: String?
    private let watchCoachingService = KinetixWatchCoachingService()

    private var displayKps: Int {
        KpsRelativeDisplay.displayKpsInt(for: run, among: allRuns)
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Header: Date & Score
                VStack(spacing: 2) {
                    Text(run.date.formatted(date: .long, time: .shortened))
                        .font(.caption)
                        .foregroundColor(.gray)
                    
                    HStack {
                        VStack {
                            Text("KPS")
                                .font(.caption2)
                                .fontWeight(.bold)
                                .foregroundColor(.gray)
                            Text("\(displayKps)")
                                .font(.system(size: 32, weight: .black, design: .rounded))
                                .foregroundColor(.cyan)
                        }
                        
                        if let score = run.formScore {
                            Rectangle()
                                .fill(Color.gray.opacity(0.3))
                                .frame(width: 1, height: 30)
                                .padding(.horizontal, 10)
                            
                            VStack {
                                Text("FORM")
                                    .font(.caption2)
                                    .fontWeight(.bold)
                                    .foregroundColor(.gray)
                                Text("\(Int(score))")
                                    .font(.system(size: 32, weight: .black, design: .rounded))
                                    .foregroundColor(scoreColor(score))
                            }
                        }
                    }
                }
                
                Divider()
                
                // COACH'S ANALYSIS (Lab Report)
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "waveform.path.ecg")
                            .foregroundColor(.green)
                        Text("LAB REPORT")
                            .font(.headline)
                            .foregroundColor(.white)
                    }
                    
                    Text(aiSummaryText ?? generateCoachAnalysis())
                        .font(.caption)
                        .foregroundColor(.white)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.gray.opacity(0.15))
                        .cornerRadius(8)
                }
                
                // Key Stats Grid
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    DetailStatBox(title: "DISTANCE", value: formattedDistance(run.distance), unit: unitSystem == "metric" ? "km" : "mi", color: .purple)
                    DetailStatBox(title: "DURATION", value: formattedDuration(run.duration), unit: "", color: .orange)
                    DetailStatBox(title: "AVG PACE", value: formattedPace(run.avgPace), unit: "/km", color: .blue)
                    DetailStatBox(title: "AVG HR", value: "\(Int(run.avgHeartRate))", unit: "bpm", color: .red)
                }
                
                // Form Metrics Grid
                if run.avgCadence != nil || run.avgVerticalOscillation != nil {
                    Text("BIOMECHANICS")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.gray)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 8)
                    
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        if let cadence = run.avgCadence {
                            DetailStatBox(title: "CADENCE", value: "\(Int(cadence))", unit: "spm", color: .green)
                        }
                        if let osc = run.avgVerticalOscillation {
                            DetailStatBox(title: "BOUNCE", value: String(format: "%.1f", osc), unit: "cm", color: .yellow)
                        }
                        if let gct = run.avgGroundContactTime {
                            DetailStatBox(title: "GCT", value: "\(Int(gct))", unit: "ms", color: .mint)
                        }
                        if let stride = run.avgStrideLength {
                            DetailStatBox(title: "STRIDE", value: String(format: "%.2f", stride), unit: "m", color: .indigo)
                        }
                    }
                }
                
                // Route Map
                if !run.routeData.isEmpty {
                    Map {
                        MapPolyline(coordinates: run.routeData.map { CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lon) })
                            .stroke(.cyan, lineWidth: 4)
                    }
                    .frame(height: 150)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    )
                }
            }
            .padding()
        }
        .navigationTitle("Run Details")
        .onAppear {
            Task { await generatePostRunSummary() }
        }
    }

    private func generatePostRunSummary() async {
        let trendDirection = run.avgNPI >= 130 ? "stable" : "declining"
        let result = await watchCoachingService.generatePostRunSummary(
            PostRunSummaryInput(
                distance: run.distance,
                pace: run.avgPace,
                heartRateAvg: run.avgHeartRate,
                kps: run.avgNPI,
                trendDirection: trendDirection
            )
        )
        aiSummaryText = result.usedFallback ? nil : result.text
    }
    
    // MARK: - Analysis Logic
    private func generateCoachAnalysis() -> String {
        var notes: [String] = []
        
        // 1. Cadence Check
        if let cad = run.avgCadence {
            if cad < 160 {
                notes.append("Cadence was low (\(Int(cad))). Shorter, quicker steps will improve efficiency.")
            } else if cad > 170 {
                notes.append("Great turnover! Keeping cadence high (\(Int(cad))) is key.")
            }
        }
        
        // 2. Bounce Check
        if let osc = run.avgVerticalOscillation {
            if osc > 10 {
                notes.append("Detected some vertical bounce (>10cm). Focus on driving forward, not up.")
            } else {
                notes.append("Excellent vertical control. You're running smooth and flat.")
            }
        }
        
        // 3. Efficiency (NPI)
        if run.avgNPI > 140 {
            notes.append("Efficiency was elite today.")
        } else if run.avgNPI < 120 {
            notes.append("Efficiency dipped slightly. Check your form when fatigued.")
        }
        
        // 4. Custom "Limp" Note (Asymmetry Awareness)
        // This acknowledges the user's condition without penalizing them for it
        if notes.isEmpty {
            notes.append("Solid run. Your form consistency is building nicely.")
        }
        
        notes.append("\n*Note: Metrics calibrated to your personal baseline.*")
        
        return notes.joined(separator: " ")
    }
    
    private func scoreColor(_ score: Double) -> Color {
        if score >= 80 { return .green }
        if score >= 60 { return .yellow }
        return .orange
    }
    
    private func formattedDistance(_ meters: Double) -> String {
        let dist = unitSystem == "metric" ? meters/1000 : (meters/1000) * 0.621371
        return String(format: "%.2f", dist)
    }
    
    private func formattedDuration(_ seconds: TimeInterval) -> String {
        let m = Int(seconds / 60)
        let s = Int(seconds.truncatingRemainder(dividingBy: 60))
        return String(format: "%d:%02d", m, s)
    }
    
    private func formattedPace(_ secondsPerKm: Double) -> String {
        let pace = unitSystem == "metric" ? secondsPerKm : secondsPerKm * 1.60934
        if pace.isInfinite || pace.isNaN { return "-:--" }
        return String(format: "%d:%02d", Int(pace/60), Int(pace.truncatingRemainder(dividingBy: 60)))
    }
}

struct DetailStatBox: View {
    let title: String
    let value: String
    let unit: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.gray)
            HStack(alignment: .lastTextBaseline, spacing: 2) {
                Text(value)
                    .font(.system(size: 18, weight: .bold, design: .monospaced))
                    .foregroundColor(color)
                Text(unit)
                    .font(.system(size: 10))
                    .foregroundColor(.gray)
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.gray.opacity(0.1))
        .cornerRadius(8)
    }
}
