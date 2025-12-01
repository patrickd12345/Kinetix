import SwiftUI

/// Lightweight home hub that keeps navigation simple and offers quick entry points.
struct HomeView: View {
    @ObservedObject var locationManager: LocationManager
    @Binding var navigationPath: [String]
    @State private var recovery: RunRecoveryData?
    
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
        }
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
