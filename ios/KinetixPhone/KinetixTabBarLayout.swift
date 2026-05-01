import SwiftUI

/// Layout helpers for root tabs: iOS 18 `TabView` uses a floating tab bar that can overlap scroll edges.
enum KinetixTabBarLayout {
    /// Extra space so the last cells sit above the floating bar plus home indicator.
    static let floatingBarBottomClearance: CGFloat = 56
}

extension View {
    /// Reserves bottom inset so list/scroll content is not visually trapped under the floating tab bar.
    func kinetixFloatingTabBarClearance() -> some View {
        safeAreaInset(edge: .bottom, spacing: 0) {
            Color.clear
                .frame(height: KinetixTabBarLayout.floatingBarBottomClearance)
                .accessibilityHidden(true)
        }
    }
}
