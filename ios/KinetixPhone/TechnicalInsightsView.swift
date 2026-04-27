import SwiftUI
import SwiftData

struct TechnicalInsightsView: View {
    @StateObject private var intelligence = IntelligenceService.shared

    var body: some View {
        List {
            if intelligence.latestDecision == nil {
                ContentUnavailableView(
                    "No Decisions Logged",
                    systemImage: "brain.head.profile",
                    description: Text("Coaching decisions will appear here as they are made.")
                )
            } else if let log = intelligence.latestDecision {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Recovery Coaching")
                            .font(.headline)
                        Spacer()
                        if let date = intelligence.lastFetched {
                            Text(date, style: .date)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    Text(log.visibleReason)
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    DisclosureGroup("Technical Details") {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Code: \(log.decisionCode)")
                            Text("State: \(log.recoveryState)")
                            Text("Guidance: \(log.guidance)")
                        }
                        .font(.system(size: 10, weight: .regular, design: .monospaced))
                        .foregroundColor(.gray)
                        .padding(.top, 4)
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle("Technical Insights")
    }
}
