import SwiftUI
import MapKit
import Charts
import SwiftData

struct HistoryView: View {
    @Query(sort: [SortDescriptor<Run>(\.date, order: .reverse)]) private var runs: [Run]
    
    var body: some View {
        NavigationStack {
            List {
                if runs.isEmpty {
                    ContentUnavailableView("No Runs Yet", systemImage: "figure.run", description: Text("Start a run on your iPhone or Watch to see it here."))
                        .foregroundStyle(.white)
                        .listRowBackground(Color.clear)
                } else {
                    ForEach(runs) { run in
                        NavigationLink(destination: RunDetailView(run: run)) {
                            RunRow(run: run, allRuns: runs)
                        }
                        .listRowBackground(Color.white.opacity(0.05))
                    }
                }
            }
            .navigationTitle("History")
            .toolbarColorScheme(.dark, for: .navigationBar)
            .scrollContentBackground(.hidden)
            .background(Color(white: 0.05).ignoresSafeArea())
        }
    }
}

struct RunRow: View {
    let run: Run
    let allRuns: [Run]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(run.date.formatted(date: .abbreviated, time: .shortened))
                    .font(.system(size: 16, weight: .black))
                    .foregroundColor(.white)
                Spacer()
                Text("\(KpsRelativeDisplay.displayKpsInt(for: run, among: allRuns)) KPS")
                    .font(.system(size: 14, weight: .black))
                    .foregroundColor(.cyan)
            }

            HStack(spacing: 16) {
                Label(String(format: "%.2f km", run.distance / 1000), systemImage: "figure.run")
                Label(formatDuration(run.duration), systemImage: "clock")
                if run.source != "recorded" {
                    Label(run.source.uppercased(), systemImage: "arrow.down.circle")
                        .foregroundColor(.orange)
                }
            }
            .font(.system(size: 12, weight: .bold))
            .foregroundColor(.white.opacity(0.5))
        }
        .padding(.vertical, 4)
    }
    
    private func formatDuration(_ duration: TimeInterval) -> String {
        let m = Int(duration / 60)
        let s = Int(duration.truncatingRemainder(dividingBy: 60))
        return String(format: "%d:%02d", m, s)
    }
}

struct RunDetailView: View {
    let run: Run
    @Environment(\.modelContext) private var modelContext
    @Query(sort: [SortDescriptor<Run>(\.date, order: .reverse)]) private var allRuns: [Run]
    @Query private var profiles: [RunnerProfile]
    
    @StateObject private var aiCoach = AICoach()
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // 1. Hero Map
                if !run.routeData.isEmpty {
                    Map(initialPosition: .region(calculateRegion())) {
                        MapPolyline(coordinates: run.routeData.map { CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lon) })
                            .stroke(.cyan, lineWidth: 5)

                        if let start = run.routeData.first {
                            Marker("Start", coordinate: CLLocationCoordinate2D(latitude: start.lat, longitude: start.lon))
                                .tint(.green)
                        }
                        if let end = run.routeData.last {
                            Marker("Finish", coordinate: CLLocationCoordinate2D(latitude: end.lat, longitude: end.lon))
                                .tint(.red)
                        }
                    }
                    .frame(height: 300)
                    .cornerRadius(24)
                    .overlay(
                        VStack {
                            Spacer()
                            HStack {
                                Spacer()
                                Text(run.source.uppercased())
                                    .font(.system(size: 10, weight: .black))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(.ultraThinMaterial)
                                    .cornerRadius(8)
                                    .padding(12)
                            }
                        }
                    )
                }

                // 2. Performance Summary
                HStack(spacing: 16) {
                    PerformanceMetricCard(label: "KPS", value: "\(KpsRelativeDisplay.displayKpsInt(for: run, among: allRuns))", icon: "bolt.fill", color: .cyan)
                    PerformanceMetricCard(label: "DISTANCE", value: String(format: "%.2f", run.distance / 1000), unit: "KM", icon: "figure.run", color: .blue)
                }
                
                // 3. Detailed Metrics Grid
                VStack(alignment: .leading, spacing: 16) {
                    Text("BIOMECHANICS & METRICS")
                        .font(.system(size: 12, weight: .black))
                        .tracking(2)
                        .foregroundColor(.gray)

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        MetricRowView(label: "Avg Pace", value: formatPace(run.avgPace), icon: "speedometer")
                        MetricRowView(label: "Avg HR", value: "\(Int(run.avgHeartRate)) bpm", icon: "heart.fill")
                        MetricRowView(label: "Duration", value: formatDuration(run.duration), icon: "clock.fill")
                        MetricRowView(label: "Cadence", value: "\(Int(run.avgCadence ?? 0)) spm", icon: "shoe.2.fill")
                        MetricRowView(label: "Bounce", value: String(format: "%.1f cm", run.avgVerticalOscillation ?? 0), icon: "arrow.up.and.down")
                        MetricRowView(label: "Stride", value: String(format: "%.2f m", run.avgStrideLength ?? 0), icon: "arrow.left.and.right")
                    }
                }
                
                // 4. AI Coach Analysis
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Text("AI COACH INSIGHTS")
                            .font(.system(size: 12, weight: .black))
                            .tracking(2)
                            .foregroundColor(.gray)
                        Spacer()
                        if aiCoach.isAnalyzing {
                            ProgressView().scaleEffect(0.8)
                        } else if aiCoach.result == nil {
                            Button("Generate Analysis") { analyzeRun() }
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.cyan)
                        }
                    }
                    
                    if let result = aiCoach.result {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(result.title)
                                .font(.system(size: 18, weight: .black))
                                .foregroundColor(.cyan)
                            Text(result.insight)
                                .font(.system(size: 15))
                                .foregroundColor(.white.opacity(0.8))
                                .lineSpacing(4)
                        }
                        .padding(20)
                        .background(Color.cyan.opacity(0.1))
                        .cornerRadius(20)
                        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.cyan.opacity(0.2), lineWidth: 1))
                    } else if aiCoach.error != nil {
                        Text("Analysis failed. Try again.")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }

                // 5. Form Report (if exists)
                if let sessionId = run.formSessionId {
                    FormMonitorReportView(sessionId: sessionId)
                }

                Spacer().frame(height: 40)
            }
            .padding()
        }
        .navigationTitle(run.date.formatted(date: .abbreviated, time: .omitted))
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .background(Color(white: 0.05).ignoresSafeArea())
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    ShareLink(item: generateExportFile(for: run, type: "gpx")) { Label("Export GPX", systemImage: "location") }
                    ShareLink(item: generateExportFile(for: run, type: "tcx")) { Label("Export TCX", systemImage: "clock") }
                    if let fitData = RunExporter.generateFIT(run: run), let fitURL = generateFITFile(for: run, data: fitData) {
                        ShareLink(item: fitURL) { Label("Export FIT", systemImage: "figure.run") }
                    }
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
            }
        }
    }
    
    private func calculateRegion() -> MKCoordinateRegion {
        let coords = run.routeData.map { CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lon) }
        guard !coords.isEmpty else { return MKCoordinateRegion() }
        
        var minLat = coords[0].latitude
        var maxLat = coords[0].latitude
        var minLon = coords[0].longitude
        var maxLon = coords[0].longitude
        
        for coord in coords {
            minLat = min(minLat, coord.latitude)
            maxLat = max(maxLat, coord.latitude)
            minLon = min(minLon, coord.longitude)
            maxLon = max(maxLon, coord.longitude)
        }

        let center = CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2)
        let span = MKCoordinateSpan(latitudeDelta: (maxLat - minLat) * 1.5, longitudeDelta: (maxLon - minLon) * 1.5)
        return MKCoordinateRegion(center: center, span: span)
    }

    private func formatDuration(_ duration: TimeInterval) -> String { return RunMetricsCalculator.formatTime(duration) }
    private func formatPace(_ pace: Double) -> String { return RunMetricsCalculator.formatPace(pace) + " /km" }
    
    private func analyzeRun() {
        aiCoach.analyzeRun(
            distance: run.distance / 1000.0,
            pace: formatPace(run.avgPace),
            npi: run.avgNPI,
            pb: profiles.first?.targetNPI ?? 135.0,
            songTitle: run.songTitle,
            songArtist: run.songArtist,
            songBpm: run.songBpm,
            avgCadence: run.avgCadence
        )
    }

    private func generateExportFile(for run: Run, type: String) -> URL {
        let fileName = "kinetix_\(run.date.formatted(date: .numeric, time: .omitted).replacingOccurrences(of: "/", with: "-"))_\(type.uppercased()).\(type)"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        let content = (type == "gpx") ? RunExporter.generateGPX(run: run) : RunExporter.generateTCX(run: run)
        try? content.write(to: url, atomically: true, encoding: .utf8)
        return url
    }

    private func generateFITFile(for run: Run, data: Data) -> URL? {
        let fileName = "kinetix_\(run.date.formatted(date: .numeric, time: .omitted).replacingOccurrences(of: "/", with: "-"))_FIT.fit"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        try? data.write(to: url)
        return url
    }
}

struct PerformanceMetricCard: View {
    let label: String
    let value: String
    var unit: String = ""
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 10, weight: .black))
                    .foregroundColor(.white.opacity(0.4))
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(value)
                        .font(.system(size: 32, weight: .black, design: .rounded))
                        .foregroundColor(.white)
                    if !unit.isEmpty {
                        Text(unit)
                            .font(.system(size: 12, weight: .black))
                            .foregroundColor(color)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(Color.white.opacity(0.05))
        .cornerRadius(24)
        .overlay(RoundedRectangle(cornerRadius: 24).stroke(Color.white.opacity(0.1), lineWidth: 1))
    }
}

struct MetricRowView: View {
    let label: String
    let value: String
    let icon: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(.cyan)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.white.opacity(0.4))
                Text(value)
                    .font(.system(size: 14, weight: .black))
                    .foregroundColor(.white)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.white.opacity(0.03))
        .cornerRadius(12)
    }
}
