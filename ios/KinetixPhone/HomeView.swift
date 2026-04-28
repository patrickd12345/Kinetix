import SwiftUI
import SwiftData

struct HomeView: View {
    @Environment(\.modelContext) private var modelContext
    @StateObject private var connectivity = ConnectivityManager.shared
    @StateObject private var intelligence = IntelligenceService.shared
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

                    // Quick Stats
                    if !runs.isEmpty {
                        let recentRun = runs.first!
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Last Run")
                                .font(.headline)
                                .foregroundColor(.secondary)
                            
                            HStack(spacing: 16) {
                                StatCard(title: "Distance", value: String(format: "%.2f", recentRun.distance / 1000), unit: "km", color: .blue)
                                StatCard(title: "KPS", value: "\(Int(recentRun.avgNPI))", unit: "", color: .cyan)
                                StatCard(title: "Pace", value: formatPace(recentRun.avgPace), unit: "/km", color: .green)
                            }
                        }
                        .padding()
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(12)
                        .padding(.horizontal)
                    }

<<<<<<< HEAD
                    // Recovery Insights (KX-FEAT-006)
                    if let decision = intelligence.latestDecision {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("Recovery Insight")
                                    .font(.headline)
                                    .foregroundColor(.secondary)
                                Spacer()
                                if let sleep = intelligence.latestRecovery?.sleepScore {
                                    HStack(spacing: 4) {
                                        Image(systemName: "zzz")
                                        Text("\(sleep)")
                                    }
                                    .font(.caption)
                                    .foregroundColor(.cyan)
                                }
                                if let battery = intelligence.latestRecovery?.bodyBattery {
                                    HStack(spacing: 4) {
                                        Image(systemName: "battery.100")
                                        Text("\(battery)%")
                                    }
                                    .font(.caption)
                                    .foregroundColor(.green)
                                }
                            }

                            let isReduced = decision.recoveryState == "reduced_intensity_recommended"

                            HStack(spacing: 12) {
                                Image(systemName: isReduced ? "exclamationmark.triangle.fill" : "checkmark.circle.fill")
                                    .font(.title2)
                                    .foregroundColor(isReduced ? .orange : .green)

                                VStack(alignment: .leading, spacing: 4) {
                                    Text(isReduced ? "Reduced Intensity Recommended" : "Optimal Recovery")
                                        .font(.subheadline)
                                        .fontWeight(.bold)
                                        .foregroundColor(isReduced ? .orange : .green)
                                    Text(decision.guidance)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                        .padding()
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(12)
                        .padding(.horizontal)
                    }

=======
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

>>>>>>> origin/main
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
                        
                        // Debug Info
                        Text("Run Active: \(connectivity.isRunActive ? "Yes" : "No")")
                            .font(.caption2)
                            .foregroundColor(.gray)
                            .padding(.top, 4)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(UIColor.secondarySystemBackground))
                    .cornerRadius(12)
                    .padding(.horizontal)
                }
                .padding(.vertical)
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingRunTracking) {
                RunTrackingView()
            }
            .onAppear {
                Task {
                    await intelligence.fetchRecoveryStatus()
                }
            }
        }
    }
    
    private func formatPace(_ pace: Double) -> String {
        let minutes = Int(pace) / 60
        let seconds = Int(pace) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
<<<<<<< HEAD

=======

    private func generateIntelligence(force: Bool = false) {
        guard force || intelligenceSummary == nil else { return }
        isIntelligenceLoading = true

        let loyalty = PlatformIdentityService.shared.checkLoyaltyStatus(runs: runs, states: [])
        self.loyaltyPoints = loyalty.points

        Task {
            let prob = await CoachingLogicService.shared.computeGoalProbability(runs: runs, profile: profiles.first)
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
>>>>>>> origin/main
}

private struct StatCard: View {
    let title: String
    let value: String
    let unit: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(value)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(color)
                Text(unit)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
