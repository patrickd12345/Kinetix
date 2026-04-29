import Foundation

class FeatureGateService {
    static let shared = FeatureGateService()

    // In beta, advanced backend integrations are gated.
    let isProFeaturesEnabled: Bool = false

    // E.g., Garmin, advanced recovery, or subscription tiers
    func isGarminSyncEnabled() -> Bool {
        return false // Beta constraint: no Garmin sync yet
    }

    func isAdvancedRecoveryEnabled() -> Bool {
        return false // Beta constraint: no advanced backend recovery UI
    }

    func isAdMobEnabled() -> Bool {
        return false // Beta constraint: no ads
    }

    func isPaymentsEnabled() -> Bool {
        return false // Beta constraint: no Stripe/subscriptions
    }
}
