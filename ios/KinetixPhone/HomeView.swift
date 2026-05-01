import SwiftUI
import SwiftData

struct HomeView: View {
    @Environment(\.modelContext) private var modelContext
    @StateObject private var connectivity = ConnectivityManager.shared
    @Query(sort: [SortDescriptor<Run>(\.date, order: .reverse)]) private var runs: [Run]
    @Query private var profiles: [RunnerProfile]
    @Binding var selectedTab: Int
    @State private var showingRunTracking = false
    @State private var intelligenceSummary: String?
    @State private var isIntelligenceLoading = false
    @State private var loyaltyPoints: Int = 0
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Header
                    VStack(alignment: .leading, spacing: 8) {
                        Text("KINETIX")
                            .font(.system(size: 24, weight: .black))
                            .italic()
                            .foregroundColor(.cyan)
                        
                        Text("Your running companion")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal)

                    // Loyalty Status
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("PLATFORM LOYALTY")
                                .font(.system(size: 8, weight: .black))
                                .foregroundColor(.orange)
                            Text("\(loyaltyPoints) pts")
                                .font(.system(size: 14, weight: .black))
                                .foregroundColor(.white)
                        }
                        Spacer()
                        Image(systemName: "crown.fill")
                            .foregroundColor(.orange)
                            .font(.caption)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.orange.opacity(0.1))
                    .cornerRadius(12)
                    .padding(.horizontal)

                    // KPS-first hero (PB-relative, capped 0…100 — matches web KPS display policy)
                    if !runs.isEmpty {
                        let recentRun = runs.first!
                        let displayKPS = KpsRelativeDisplay.displayRelativeKps(for: recentRun, among: runs)
                        let kpsPts = KpsRelativeDisplay.displayKpsInt(for: recentRun, among: runs)
                        let pbRun = KpsRelativeDisplay.personalBestRun(from: runs)

                        VStack(alignment: .leading, spacing: 16) {
                            Text("YOUR LAST RUN")
                                .font(.caption)
                                .fontWeight(.bold)
                                .tracking(3)
                                .foregroundStyle(.secondary)

                            ZStack {
                                RoundedRectangle(cornerRadius: 28)
                                    .fill(
                                        LinearGradient(
                                            colors: [Color.cyan.opacity(0.35), Color.blue.opacity(0.45)],
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        )
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 28)
                                            .stroke(Color.white.opacity(0.2), lineWidth: 1)
                                    )

                                VStack(spacing: 12) {
                                    Text("KINETIX PERFORMANCE SCORE")
                                        .font(.system(size: 11, weight: .heavy))
                                        .tracking(2.5)
                                        .foregroundStyle(.white.opacity(0.85))

                                    if kpsPts > 0 {
                                        Text("\(kpsPts)")
                                            .font(.system(size: 72, weight: .black, design: .rounded))
                                            .foregroundStyle(.white)
                                            .minimumScaleFactor(0.5)
                                            .lineLimit(1)
                                            .accessibilityLabel("KPS score \(kpsPts) out of 100")
                                    } else {
                                        Text("—")
                                            .font(.system(size: 56, weight: .black, design: .rounded))
                                            .foregroundStyle(.white.opacity(0.9))
                                    }

                                    Text("out of 100")
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundStyle(.white.opacity(0.75))

                                    Text(
                                        "\(String(format: "%.2f", recentRun.distance / 1000)) km · \(formatPace(recentRun.avgPace))/km"
                                    )
                                    .font(.system(size: 15, weight: .medium))
                                    .foregroundStyle(.white.opacity(0.95))

                                    Text(homePbStatusLine(recent: recentRun, displayKPS: displayKPS, pbRun: pbRun))
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundStyle(.white.opacity(0.8))
                                        .multilineTextAlignment(.center)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .padding(.vertical, 28)
                                .padding(.horizontal, 20)
                                .frame(maxWidth: .infinity)
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .padding(.horizontal)
                    }
                    
                    // Apple Intelligence Readiness Card
                    if DefaultKinetixAppleIntelligenceService.shared.isAppleIntelligenceAvailable() == .available {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Image(systemName: "sparkles")
                                    .foregroundColor(.cyan)
                                Text("INTELLIGENCE")
                                    .font(.system(size: 10, weight: .black))
                                    .tracking(2)
                                    .foregroundColor(.cyan)
                                Spacer()
                                if isIntelligenceLoading {
                                    ProgressView().scaleEffect(0.7)
                                }
                            }

                            if let summary = intelligenceSummary {
                                Text(summary)
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(.primary)
                                    .lineSpacing(4)
                            } else {
                                Text("Analyzing your recent activity...")
                                    .font(.system(size: 14))
                                    .foregroundColor(.secondary)
                                    .italic()
                            }
                        }
                        .padding(20)
                        .background(Color.cyan.opacity(0.05))
                        .cornerRadius(24)
                        .overlay(
                            RoundedRectangle(cornerRadius: 24)
                                .stroke(Color.cyan.opacity(0.2), lineWidth: 1)
                        )
                        .padding(.horizontal)
                        .onAppear {
                            generateIntelligence()
                        }
                        .onChange(of: runs) { _, _ in
                            generateIntelligence(force: true)
                        }
                    }

                    // Primary Action
                    Button(action: {
                        showingRunTracking = true
                    }) {
                        HStack(spacing: 16) {
                            Image(systemName: "play.circle.fill")
                                .font(.system(size: 44))
                                .foregroundColor(.white)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("START RUN")
                                    .font(.system(size: 20, weight: .black))
                                    .italic()
                                    .foregroundColor(.white)
                                Text("Track directly on your iPhone")
                                    .font(.caption)
                                    .fontWeight(.bold)
                                    .foregroundColor(.white.opacity(0.8))
                            }

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.headline)
                                .foregroundColor(.white.opacity(0.6))
                        }
                        .padding(24)
                        .background(
                            LinearGradient(
                                colors: [.cyan, .blue],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .cornerRadius(24)
                        .shadow(color: .cyan.opacity(0.3), radius: 10, x: 0, y: 5)
                    }
                    .padding(.horizontal)
                    .buttonStyle(PlainButtonStyle())

                    // Quick Access Tiles (informational - tabs accessible via tab bar)
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Explore")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                            HomeTile(
                                title: "Coach",
                                systemImage: "figure.run",
                                accent: .cyan,
                                description: "Live coaching & metrics"
                            ) {
                                selectedTab = 1 // Dashboard tab
                            }
                            
                            HomeTile(
                                title: "Build",
                                systemImage: "hammer",
                                accent: .orange,
                                description: "Create activities"
                            ) {
                                selectedTab = 2 // Build tab
                            }
                            
                            HomeTile(
                                title: "History",
                                systemImage: "clock.arrow.circlepath",
                                accent: .yellow,
                                description: "Past runs"
                            ) {
                                selectedTab = 3 // History tab
                            }
                            
                            HomeTile(
                                title: "Settings",
                                systemImage: "gearshape",
                                accent: .purple,
                                description: "App configuration"
                            ) {
                                selectedTab = 4 // Settings tab
                            }
                        }
                    }
                    .padding(.horizontal)
                    
                    // Watch Connection Status
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: connectivity.isWatchConnected ? "applewatch" : "applewatch.slash")
                                .foregroundColor(connectivity.isWatchConnected ? .green : .orange)
                            Text(connectivity.isWatchConnected ? "Watch Connected" : "Watch Disconnected")
                                .font(.subheadline)
                                .fontWeight(.medium)
                        }
                        
                        Text(connectivity.connectionStatusMessage)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        if !connectivity.isWatchConnected {
                            Text("Make sure your Apple Watch is nearby and paired.")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(UIColor.secondarySystemBackground))
                    .cornerRadius(12)
                    .padding(.horizontal)
                }
                .padding(.vertical)
            }
            .kinetixFloatingTabBarClearance()
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingRunTracking) {
                RunTrackingView()
            }
        }
    }
    
    private func formatPace(_ pace: Double) -> String {
        let minutes = Int(pace) / 60
        let seconds = Int(pace) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    /// PB delta / status for the last-run hero (native NPI ratio vs lifetime best in history).
    private func homePbStatusLine(recent: Run, displayKPS: Double, pbRun: Run?) -> String {
        guard let pb = pbRun else {
            return displayKPS > 0 ? "vs lifetime best" : "Build your KPS baseline"
        }
        if recent.id == pb.id {
            return "Personal best · peak KPS is 100"
        }
        let gap = 100 - displayKPS
        if gap < 1 {
            return "Near your peak KPS"
        }
        return String(format: "%.0f KPS below your best", gap)
    }

    private func generateIntelligence(force: Bool = false) {
        guard force || intelligenceSummary == nil else { return }
        isIntelligenceLoading = true

        let loyalty = PlatformIdentityService.shared.checkLoyaltyStatus(runs: runs, states: [])
        self.loyaltyPoints = loyalty.points

        Task {
            let prob = CoachingLogicService.shared.computeGoalProbability(runs: runs, profile: profiles.first)
            let input = ReadinessExplanationInput(
                readinessScore: Int(prob.probability * 100),
                readinessStatus: prob.probability > 0.7 ? "Peak" : "Building",
                fatigueLevel: "Low",
                trendDirection: prob.direction.rawValue,
                recommendationType: "Aerobic"
            )

            let result = await DefaultKinetixAppleIntelligenceService.shared.generateReadinessExplanation(input)

            await MainActor.run {
                self.intelligenceSummary = result.text
                self.isIntelligenceLoading = false
            }
        }
    }
}

private struct HomeTile: View {
    let title: String
    let systemImage: String
    let accent: Color
    let description: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 12) {
                Image(systemName: systemImage)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(accent)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline)
                        .foregroundColor(.primary)
                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(Color(UIColor.secondarySystemBackground))
            .cornerRadius(16)
        }
        .buttonStyle(.plain)
    }
}
