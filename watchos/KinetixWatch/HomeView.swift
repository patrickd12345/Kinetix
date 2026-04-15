import SwiftUI

/// Lightweight home hub that keeps navigation simple and offers quick entry points.
struct HomeView: View {
    @ObservedObject var locationManager: LocationManager
    @Binding var navigationPath: [String]
    @State private var recovery: RunRecoveryData?
    @State private var readinessLoading = true
    @State private var preRunSuggestionText: String?
    @State private var recoveryAlertText: String?
    private let watchCoachingService = KinetixWatchCoachingService()
    @AppStorage("weightUnit") private var weightUnit = "lbs"
    private let kgToLbs = 2.20462
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("KINETIX")
                    .font(.system(size: 12, weight: .black))
                    .italic()
                    .foregroundColor(.cyan)
                
                Text("Choose where to go")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.gray)

                RaceReadinessCard(
                    loading: readinessLoading,
                    error: locationManager.raceReadinessError,
                    readiness: locationManager.raceReadinessSnapshot,
                    preRunSuggestion: preRunSuggestionText,
                    recoveryAlert: recoveryAlertText
                )

                if locationManager.latestSyncedWeightKg > 0 {
                    Text("Latest weight: \(formatWeight(locationManager.latestSyncedWeightKg)) \(weightUnit)")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundColor(.mint)
                }
                
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    HomeTile(title: "Activities", systemImage: "figure.run", accent: .cyan) {
                        navigationPath.append("Activities")
                    }
                    
                    HomeTile(title: "Settings", systemImage: "gearshape", accent: .orange) {
                        navigationPath.append("Settings")
                    }
                    
                    HomeTile(title: "Tools / Lab", systemImage: "wand.and.stars", accent: .purple) {
                        // Route to manual/tools via main tab stack for now
                        navigationPath.append("RunView")
                    }
                    
                    if let recovery {
                        HomeTile(title: "Resume", systemImage: "play.circle", accent: .green) {
                            locationManager.recoverRun(recovery)
                            navigationPath.append("RunView")
                        }
                    } else {
                        HomeTile(title: "History", systemImage: "clock.arrow.circlepath", accent: .yellow) {
                            // History is accessible inside RunView tab stack
                            navigationPath.append("RunView")
                        }
                    }
                }
            }
            .padding()
        }
        .onAppear {
            recovery = locationManager.checkForRecovery()
            locationManager.requestLatestWithingsWeightSync()
            readinessLoading = true
            locationManager.requestRaceReadinessSync()
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                readinessLoading = false
                Task {
                    await refreshAppleIntelligenceCopy()
                }
            }
        }
    }

    private func refreshAppleIntelligenceCopy() async {
        guard let readiness = locationManager.raceReadinessSnapshot else {
            preRunSuggestionText = nil
            recoveryAlertText = nil
            return
        }

        let fatigueLevel = readiness.status == "low" ? "high" : (readiness.status == "moderate" ? "moderate" : "low")
        let recommendation = readiness.recommendedWorkout ?? "easy_run"

        let preRun = await watchCoachingService.generatePreRunSuggestion(
            PreRunSuggestionInput(
                readinessScore: readiness.score,
                fatigueLevel: fatigueLevel,
                recommendationType: recommendation
            )
        )
        preRunSuggestionText = preRun.text

        let recovery = await watchCoachingService.generateRecoveryAlert(
            RecoveryAlertInput(
                fatigueLevel: fatigueLevel,
                readinessScore: readiness.score
            )
        )
        recoveryAlertText = recovery.text
    }

    private func formatWeight(_ kg: Double) -> String {
        let value = weightUnit == "lbs" ? kg * kgToLbs : kg
        return String(format: "%.1f", value)
    }
}

private struct RaceReadinessCard: View {
    let loading: Bool
    let error: String?
    let readiness: RaceReadinessSnapshot?
    let preRunSuggestion: String?
    let recoveryAlert: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Race Readiness")
                .font(.system(size: 12, weight: .black))
                .foregroundColor(.white)

            if loading {
                Text("Computing readiness…")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.gray)
            } else if error != nil {
                Text("Unable to compute")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.red)
            } else if let readiness {
                Text("\(readiness.score)")
                    .font(.system(size: 36, weight: .black, design: .rounded))
                    .foregroundColor(.cyan)
                    .monospacedDigit()
                Text(readiness.status.capitalized)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.mint)
                Text(readiness.message)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.gray)
                if let recommendation = readiness.recommendedWorkout, !recommendation.isEmpty {
                    Text("Suggested: \(recommendation)")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.orange)
                }
                if let preRunSuggestion, !preRunSuggestion.isEmpty {
                    Text(preRunSuggestion)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.cyan)
                }
                if let recoveryAlert, !recoveryAlert.isEmpty {
                    Text(recoveryAlert)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(.yellow)
                }
            } else {
                Text("Not enough recent data")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.gray)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.black.opacity(0.3))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.cyan.opacity(0.4), lineWidth: 1)
                )
        )
    }
}

private struct HomeTile: View {
    let title: String
    let systemImage: String
    let accent: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: systemImage)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(accent)
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(.white)
            }
            .frame(maxWidth: .infinity, minHeight: 70)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.black.opacity(0.3))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(accent.opacity(0.5), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
    }
}
