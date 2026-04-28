import Foundation

enum Features {
    /// When true, cloud sync + Strava surfaces stay hidden until `EntitlementService` reports an active Kinetix entitlement (server-backed).
    static let requireEntitlementForPaidSurfaces = true

    /// Garmin UI and simulated service removed for App Store v1 (Lane C re-enables server-backed Garmin).
    static let garminEnabled = false
}
