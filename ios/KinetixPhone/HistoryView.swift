import SwiftUI
import SwiftData
import Foundation

struct HistoryView: View {
    @Query(sort: [SortDescriptor<Run>(\.date, order: .reverse)]) private var runs: [Run]
    
    var body: some View {
        NavigationStack {
            List {
                if runs.isEmpty {
                    ContentUnavailableView("No Runs Yet", systemImage: "figure.run", description: Text("Start a run on your Watch to see it here."))
                } else {
                    ForEach(runs) { run in
                        NavigationLink(destination: RunDetailView(run: run)) {
                            RunRow(run: run)
                        }
                    }
                }
            }
            .navigationTitle("History")
        }
    }
}

struct RunRow: View {
    let run: Run
    
    var body: some View {
        VStack(alignment: .leading) {
            Text(run.date.formatted(Date.FormatStyle(date: .abbreviated, time: .shortened)))
                .font(.headline)
            
            HStack {
                Label(String(format: "%.2f km", run.distance / 1000), systemImage: "map")
                Spacer()
                Label(formatDuration(run.duration), systemImage: "stopwatch")
                Spacer()
                Label("\(Int(run.avgNPI)) NPI", systemImage: "bolt")
                    .foregroundColor(.cyan)
            }
            .font(.caption)
            .foregroundColor(.gray)
        }
        .padding(.vertical, 4)
    }
    
    private func formatDuration(_ duration: TimeInterval) -> String {
        let m = Int(duration / 60)
        let s = Int(duration.truncatingRemainder(dividingBy: 60))
        return String(format: "%d:%02d", m, s)
    }
}

// Reuse the RunDetailView from shared logic? 
// Currently RunDetailView is in Watch folder but likely depends on Watch-specific layouts.
// We should probably build a Phone-specific detailed view or adapt the shared one.
// For now I'll make a simple detail view here.

struct RunDetailView: View {
    let run: Run
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Summary Card
                VStack {
                    Text("NPI SCORE").font(.caption).bold().foregroundColor(.gray)
                    Text("\(Int(run.avgNPI))")
                        .font(.system(size: 60, weight: .black, design: .rounded))
                        .foregroundColor(.cyan)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color(UIColor.secondarySystemBackground))
                .cornerRadius(12)
                
                // Metrics Grid
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                    MetricDetailCard(title: "Distance", value: String(format: "%.2f km", run.distance / 1000))
                    MetricDetailCard(title: "Duration", value: formatDuration(run.duration))
                    MetricDetailCard(title: "Avg Pace", value: formatPace(run.avgPace))
                    MetricDetailCard(title: "Avg HR", value: "\(Int(run.avgHeartRate)) bpm")
                    MetricDetailCard(title: "Cadence", value: "\(Int(run.avgCadence ?? 0)) spm")
                    MetricDetailCard(title: "Bounce", value: String(format: "%.1f cm", run.avgVerticalOscillation ?? 0))
                }
                
                // AI Analysis (Lab Report) placeholder
                Text("AI Analysis")
                    .font(.headline)
                    .padding(.top)
                Text("This run showed solid cadence stability. Vertical oscillation was slightly high at mile 2.")
                    .font(.body)
                    .padding()
                    .background(Color.blue.opacity(0.1))
                    .cornerRadius(8)
            }
            .padding()
        }
        .navigationTitle(run.date.formatted(Date.FormatStyle(date: .abbreviated, time: .omitted)))
    }
    
    private func formatDuration(_ duration: TimeInterval) -> String {
        let m = Int(duration / 60)
        let s = Int(duration.truncatingRemainder(dividingBy: 60))
        return String(format: "%d:%02d", m, s)
    }
    
    private func formatPace(_ pace: Double) -> String {
        if pace.isInfinite || pace.isNaN { return "-:--" }
        let m = Int(pace / 60)
        let s = Int(pace.truncatingRemainder(dividingBy: 60))
        return String(format: "%d:%02d /km", m, s)
    }
}

struct MetricDetailCard: View {
    let title: String
    let value: String
    
    var body: some View {
        VStack(alignment: .leading) {
            Text(title).font(.caption).foregroundColor(.gray)
            Text(value).font(.headline).bold()
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(10)
    }
}
