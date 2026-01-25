import SwiftUI

struct CompanionHomeView: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    companionHeader
                    offloadedTasks
                    quickActions
                    watchResponsibilities
                }
                .padding()
            }
            .navigationTitle("Kinetix Companion")
            .background(Color(.systemBackground))
        }
    }

    private var companionHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Offload the busywork to your phone", systemImage: "iphone")
                .font(.title3.weight(.semibold))
            Text("Use the phone for planning and tuning so the Watch can stay lean and reliable during your runs.")
                .foregroundStyle(.secondary)
                .font(.body)
        }
    }

    private var offloadedTasks: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("What the phone handles")
                .font(.headline)
            Label("Plan routes, training blocks, and warmups without crowding the Watch UI.", systemImage: "map")
            Label("Mix audio cues and haptics so the Watch only has to play them.", systemImage: "ear")
            Label("Sync lab reports and shareable summaries after each run.", systemImage: "square.and.arrow.up")
            Label("Manage backups and permissions so pairing stays stable.", systemImage: "lock.shield")
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(.secondarySystemBackground)))
    }

    private var quickActions: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Actions")
                .font(.headline)
            VStack(alignment: .leading, spacing: 12) {
                actionRow(title: "Pre-run check", subtitle: "Confirm pairing, permissions, and battery before starting a workout.", icon: "checkmark.shield")
                Divider()
                actionRow(title: "Send warmup", subtitle: "Pick a warmup or drill set and push it to the Watch.", icon: "figure.run")
                Divider()
                actionRow(title: "Lab reports", subtitle: "Browse recent runs captured on Apple Watch and review efficiency notes.", icon: "chart.bar.doc.horizontal")
                Divider()
                actionRow(title: "Coach tuning", subtitle: "Adjust cue timing, intensity, and when to nudge cadence versus stride length.", icon: "waveform")
            }
            .padding()
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(.secondarySystemBackground)))
        }
    }

    private var watchResponsibilities: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("What stays on the Watch")
                .font(.headline)
            Label("Workout control and live sensors remain on Watch for reliability.", systemImage: "applewatch")
            Label("HealthKit permissions originate on Watch; the phone mirrors stats and settings.", systemImage: "heart.circle")
            Label("Live cues still execute on Watch; this app preloads the timing and audio.", systemImage: "bolt.horizontal")
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(.secondarySystemBackground)))
    }

    private func actionRow(title: String, subtitle: String, icon: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(.green)
                .font(.title3)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(subtitle)
                    .foregroundStyle(.secondary)
                    .font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
        }
    }
}

#Preview {
    CompanionHomeView()
}
