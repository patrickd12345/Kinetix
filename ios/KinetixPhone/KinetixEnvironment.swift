import Foundation

enum KinetixEnvironment {
    /// Production Kinetix web origin (subscriptions, Strava token exchange, future APIs).
    static var webBaseURL: URL {
        let raw = Bundle.main.object(forInfoDictionaryKey: "KINETIX_WEB_BASE_URL") as? String
        let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if let url = URL(string: trimmed), !trimmed.isEmpty {
            return url
        }
        return URL(string: "https://kinetix.bookiji.com")!
    }

    static var stravaClientId: String {
        (Bundle.main.object(forInfoDictionaryKey: "STRAVA_CLIENT_ID") as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static var googleClientId: String {
        (Bundle.main.object(forInfoDictionaryKey: "GOOGLE_CLIENT_ID") as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
