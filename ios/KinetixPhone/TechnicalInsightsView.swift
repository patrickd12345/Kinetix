import SwiftUI
import SwiftData

struct TechnicalInsightsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: [SortDescriptor<ReasoningLog>(\.timestamp, order: .reverse)]) private var logs: [ReasoningLog]

    var body: some View {
        List {
            Section {
                if logs.isEmpty {
                    Text("No reasoning logs generated yet. Omni-Intelligence will log its chain of thought here.")
                        .font(.caption)
                        .foregroundColor(.gray)
                } else {
                    ForEach(logs) { log in
                        ReasoningLogRow(log: log)
                    }
                }
            } header: {
                Text("Omni-Intelligence Reasoning Chain")
            } footer: {
                Text("These logs capture the full decision-making process of the Agentic Core, including telemetry ingestion and proactive adaptations.")
            }
        }
        .navigationTitle("Technical Insights")
        .scrollContentBackground(.hidden)
        .background(Color(white: 0.05).ignoresSafeArea())
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(action: {
                    Task {
                        await MultiSignalCoachingEngine.shared.applyProactiveAdaptation(modelContext: modelContext)
                    }
                }) {
                    Label("Re-run adaptation", systemImage: "arrow.triangle.2.circlepath")
                        .font(.caption)
                }
            }
        }
    }
}

struct ReasoningLogRow: View {
    let log: ReasoningLog
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(log.category.uppercased())
                        .font(.system(size: 10, weight: .black))
                        .foregroundColor(categoryColor(log.category))
                    Text(log.decision)
                        .font(.system(size: 16, weight: .black))
                        .foregroundColor(.white)
                }
                Spacer()
                Text(log.timestamp.formatted(date: .omitted, time: .shortened))
                    .font(.caption2)
                    .foregroundColor(.gray)
            }

            Text(log.reasoningChain)
                .font(.system(size: 13))
                .foregroundColor(.white.opacity(0.7))
                .lineLimit(isExpanded ? nil : 2)

            if !log.inputs.isEmpty {
                Button(action: { isExpanded.toggle() }) {
                    Text(isExpanded ? "Hide Telemetry" : "View Telemetry Inputs")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.cyan)
                }

                if isExpanded {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(log.inputs.sorted(by: { $0.key < $1.key }), id: \.key) { key, value in
                            HStack {
                                Text(key)
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.white.opacity(0.4))
                                Spacer()
                                Text(value)
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundColor(.cyan)
                            }
                        }
                    }
                    .padding(8)
                    .background(Color.white.opacity(0.03))
                    .cornerRadius(8)
                }
            }
        }
        .padding(.vertical, 8)
        .listRowBackground(Color.white.opacity(0.05))
    }

    private func categoryColor(_ cat: String) -> Color {
        switch cat.lowercased() {
        case "recovery": return .cyan
        case "training": return .purple
        case "productivity": return .indigo
        default: return .gray
        }
    }
}
