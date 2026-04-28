import Combine
import Foundation

struct EntitlementState: Equatable {
    var isActive: Bool
    var endsAt: Date?
    var source: String?
    /// Developer-facing status when the subscription gate cannot be evaluated.
    var reason: String?
}

/// Calls `GET /api/entitlements?product_key=kinetix` with the Supabase JWT (Lane A implements the route).
@MainActor
final class EntitlementService: ObservableObject {
    static let shared = EntitlementService()

    @Published private(set) var state: EntitlementState = EntitlementState(
        isActive: false,
        endsAt: nil,
        source: nil,
        reason: "server endpoint pending"
    )

    var isActive: Bool { state.isActive }

    func refresh() async {
        guard AuthService.shared.client != nil else {
            state = EntitlementState(isActive: false, endsAt: nil, source: nil, reason: "Supabase not configured in xcconfig")
            return
        }

        guard let token = await AuthService.shared.currentAccessToken(), !token.isEmpty else {
            state = EntitlementState(isActive: false, endsAt: nil, source: nil, reason: "not signed in")
            return
        }

        let base = KinetixEnvironment.webBaseURL
        var components = URLComponents(url: base.appendingPathComponent("api/entitlements"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "product_key", value: "kinetix")]
        guard let url = components.url else {
            state = EntitlementState(isActive: false, endsAt: nil, source: nil, reason: "bad entitlements URL")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                applyPending(message: "invalid response")
                return
            }

            if http.statusCode == 404 || http.statusCode == 501 {
                applyPending(message: "server endpoint pending")
                return
            }

            guard http.statusCode == 200 else {
                applyPending(message: "HTTP \(http.statusCode)")
                return
            }

            let decoded = try JSONDecoder().decode(EntitlementsAPIResponse.self, from: data)
            let endsAt = decoded.ends_at.flatMap { isoDate(from: $0) }
            state = EntitlementState(
                isActive: decoded.active,
                endsAt: endsAt,
                source: decoded.source,
                reason: nil
            )
        } catch {
            applyPending(message: "server endpoint pending")
        }
    }

    private func applyPending(message: String) {
        state = EntitlementState(isActive: false, endsAt: nil, source: nil, reason: message)
    }

    private func isoDate(from raw: String) -> Date? {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: raw) { return d }
        iso.formatOptions = [.withInternetDateTime]
        return iso.date(from: raw)
    }
}

private struct EntitlementsAPIResponse: Decodable {
    let active: Bool
    let ends_at: String?
    let source: String?
}
