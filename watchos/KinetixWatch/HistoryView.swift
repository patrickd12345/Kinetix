import SwiftUI
import SwiftData

// MARK: - PAGE 3: HISTORY
struct HistoryView: View {
    let unitSystem: String
    @Query(sort: \Run.date, order: .reverse) private var runs: [Run]
    
    var body: some View {
        List {
            if runs.isEmpty {
                Text("No runs recorded.").foregroundColor(.gray)
            } else {
                ForEach(runs) { run in
                    NavigationLink(destination: RunDetailView(run: run, unitSystem: unitSystem)) {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(run.date.formatted(date: .abbreviated, time: .shortened))
                                    .font(.caption2)
                                    .foregroundColor(.gray)
                                Spacer()
                                Text("NPI \(Int(run.avgNPI))")
                                    .font(.system(size: 12, weight: .black))
                                    .foregroundColor(.cyan)
                            }
                            
                            HStack {
                                ValueLabel(value: formattedDistance(run.distance), label: unitSystem == "metric" ? "km" : "mi")
                                Spacer()
                                ValueLabel(value: formattedDuration(run.duration), label: "time")
                                Spacer()
                                ValueLabel(value: "\(Int(run.avgHeartRate))", label: "bpm")
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
                .onDelete(perform: deleteItems)
            }
        }
        .navigationTitle("History")
    }
    
    @Environment(\.modelContext) private var modelContext
    
    private func deleteItems(offsets: IndexSet) {
        withAnimation {
            for index in offsets {
                modelContext.delete(runs[index])
            }
        }
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
}

struct ValueLabel: View {
    let value: String
    let label: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(value).font(.system(size: 14, design: .monospaced)).fontWeight(.bold)
            Text(label).font(.system(size: 8)).foregroundColor(.gray)
        }
    }
}
