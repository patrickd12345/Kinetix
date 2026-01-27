import SwiftUI
import SwiftData

struct HomeView: View {
    @Environment(\.modelContext) private var modelContext
    @StateObject private var connectivity = ConnectivityManager.shared
    @Query(sort: [SortDescriptor<Run>(\.date, order: .reverse)]) private var runs: [Run]
    @Binding var selectedTab: Int
    @State private var showingRunTracking = false
    
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
                    
                    // Quick Stats
                    if !runs.isEmpty {
                        let recentRun = runs.first!
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Last Run")
                                .font(.headline)
                                .foregroundColor(.secondary)
                            
                            HStack(spacing: 16) {
                                StatCard(
                                    title: "Distance",
                                    value: String(format: "%.2f", recentRun.distance / 1000),
                                    unit: "km",
                                    color: .blue
                                )
                                
                                StatCard(
                                    title: "KPS",
                                    value: String(format: "%.1f", recentRun.kps),
                                    unit: "",
                                    color: .cyan
                                )
                                
                                StatCard(
                                    title: "Pace",
                                    value: formatPace(recentRun.avgPace),
                                    unit: "/km",
                                    color: .green
                                )
                            }
                        }
                        .padding()
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(12)
                        .padding(.horizontal)
                    }
                    
                    // Quick Access Tiles (informational - tabs accessible via tab bar)
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Quick Access")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                            HomeTile(
                                title: "Start Run",
                                systemImage: "play.circle.fill",
                                accent: .green,
                                description: "Track with iPhone"
                            ) {
                                showingRunTracking = true
                            }
                            
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
        }
    }
    
    private func formatPace(_ pace: Double) -> String {
        let minutes = Int(pace) / 60
        let seconds = Int(pace) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
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

