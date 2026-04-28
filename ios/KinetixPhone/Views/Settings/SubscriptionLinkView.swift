import SafariServices
import SwiftUI

/// Opens `https://kinetix.bookiji.com/billing` in `SFSafariViewController`. Reader-app posture: no StoreKit and no purchase CTA copy in-app.
struct SubscriptionLinkView: UIViewControllerRepresentable {
    let url: URL

    init(url: URL = URL(string: "https://kinetix.bookiji.com/billing")!) {
        self.url = url
    }

    func makeUIViewController(context: Context) -> SFSafariViewController {
        let safari = SFSafariViewController(url: url)
        safari.dismissButtonStyle = .close
        return safari
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}

/// Neutral label per App Store reader-app guidelines (no Subscribe / Upgrade / Buy language).
struct ManageAccountOnWebButton: View {
    @State private var showBilling = false

    var body: some View {
        Button {
            showBilling = true
        } label: {
            Label("Manage your account", systemImage: "safari")
        }
        .sheet(isPresented: $showBilling) {
            SubscriptionLinkView()
                .ignoresSafeArea()
        }
    }
}
