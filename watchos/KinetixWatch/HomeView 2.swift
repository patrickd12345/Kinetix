import SwiftUI

struct HomeView: View {
    @ObservedObject var locationManager: LocationManager
    @Binding var navigationPath: [String]
    @AppStorage("skipHomeScreen") private var skipHomeScreen = false

    var body: some View {
        VStack(spacing: 12) {
            Text("Welcome to Kinetix")
                .font(.headline)
            Text("Choose a preset to start your activity. You can skip this screen next time.")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)

            Toggle("Don't show again", isOn: $skipHomeScreen)
                .padding(.top, 4)

            Button("Get Started") {
                navigationPath.append("Activities")
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 4)
        }
        .padding()
    }
}

#Preview {
    HomeView(locationManager: LocationManager(), navigationPath: .constant([]))
}
