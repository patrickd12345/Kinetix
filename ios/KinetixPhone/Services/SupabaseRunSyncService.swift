import Foundation
import Supabase
import SwiftData

/// Best-effort upsert of locally-stored `Run` records into Supabase for the
/// signed-in Kinetix user.
///
/// Introduced because `MainTabView`'s startup Strava sync calls
/// `SupabaseRunSyncService.shared.upsertRuns(_:)` but the service file was
/// not present in the repository, which broke the iOS build (see commit
/// `ed18e3b`). This stub keeps the call site type-correct and degrades
/// silently when Supabase is unconfigured or the user is signed out -- the
/// same posture as the rest of the cloud surfaces in this product.
///
/// The actual server-side `runs` table contract (column names, RLS policies,
/// conflict resolution) is not yet defined for Kinetix, so this implementation
/// intentionally does not attempt a remote upsert. When the schema lands,
/// flesh out `upsertRuns` to call the appropriate `client.from("runs")`
/// query path, and update callers to react to the actual return value.
@MainActor
final class SupabaseRunSyncService {
    static let shared = SupabaseRunSyncService()

    private init() {}

    /// Attempt to upsert the given runs to Supabase. Returns the number of
    /// rows the service would have sent. No-ops (returns 0) when Supabase
    /// is not configured for this build or no auth session exists.
    @discardableResult
    func upsertRuns(_ runs: [Run]) async throws -> Int {
        guard !runs.isEmpty else { return 0 }
        guard AuthService.shared.client != nil else { return 0 }
        guard await AuthService.shared.currentAccessToken() != nil else {
            return 0
        }
        return runs.count
    }
}
