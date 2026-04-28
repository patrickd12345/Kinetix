import Combine
import Foundation
import Supabase

/// Persists Supabase Auth session via the SDK (Keychain-backed storage on iOS).
@MainActor
final class AuthService: ObservableObject {
    static let shared = AuthService()

    /// Live client when `SUPABASE_URL` / `SUPABASE_ANON_KEY` are configured in xcconfig; otherwise nil and auth stays offline-only.
    private(set) var client: SupabaseClient?

    @Published private(set) var hasSession: Bool = false

    private init() {
        let rawUrl = (Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let anon = (Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let url = URL(string: rawUrl),
              !anon.isEmpty,
              !rawUrl.contains("YOUR_PROJECT"),
              anon != "REPLACE_WITH_SUPABASE_ANON_KEY" else {
            client = nil
            return
        }

        client = SupabaseClient(supabaseURL: url, supabaseKey: anon)
    }

    /// Restore persistent session from Keychain-backed SDK storage (if configured).
    func bootstrap() async {
        guard let client else {
            hasSession = false
            return
        }
        do {
            _ = try await client.auth.session
            hasSession = true
        } catch {
            hasSession = false
        }
    }

    func currentAccessToken() async -> String? {
        guard let client else { return nil }
        do {
            let session = try await client.auth.session
            hasSession = true
            return session.accessToken
        } catch {
            hasSession = false
            return nil
        }
    }

    func signOut() async {
        guard let client else { return }
        do {
            try await client.auth.signOut()
            hasSession = false
        } catch {
            hasSession = false
        }
    }
}
