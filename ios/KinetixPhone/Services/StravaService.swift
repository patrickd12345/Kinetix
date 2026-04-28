import Foundation
import AuthenticationServices
import UIKit

/**
 * Strava API Service for iOS.
 * OAuth token exchange and refresh go through Kinetix web (`/api/strava-oauth`, `/api/strava-refresh`) so the client secret never ships in the binary.
 */
public class StravaService: NSObject {
    public static let shared = StravaService()

    private let apiBase = "https://www.strava.com/api/v3"
    private let redirectURI = "kinetix://auth/strava"

    private var authSession: ASWebAuthenticationSession?
    private var authContinuation: CheckedContinuation<StravaTokens, Error>?

    private override init() {
        super.init()
        if KinetixEnvironment.stravaClientId.isEmpty {
            print("⚠️ STRAVA_CLIENT_ID not set in build configuration.")
        }
    }

    public func areCredentialsConfigured() -> Bool {
        !KinetixEnvironment.stravaClientId.isEmpty
    }

    private func getAuthorizationURL() -> URL {
        var components = URLComponents(string: "https://www.strava.com/oauth/authorize")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: KinetixEnvironment.stravaClientId),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "activity:read_all,activity:write"),
            URLQueryItem(name: "approval_prompt", value: "force"),
        ]
        return components.url!
    }

    public func authenticate(presentingViewController: UIViewController) async throws -> StravaTokens {
        guard areCredentialsConfigured() else {
            throw StravaError.notConfigured("Strava client id not configured (STRAVA_CLIENT_ID).")
        }

        return try await withCheckedThrowingContinuation { continuation in
            self.authContinuation = continuation

            let authURL = getAuthorizationURL()

            self.authSession = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: "kinetix",
                completionHandler: { [weak self] callbackURL, error in
                    guard let self else { return }

                    if let error {
                        continuation.resume(throwing: StravaError.authenticationFailed(error.localizedDescription))
                        return
                    }

                    guard let callbackURL,
                          let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                          let code = components.queryItems?.first(where: { $0.name == "code" })?.value
                    else {
                        continuation.resume(throwing: StravaError.authenticationFailed("No authorization code received"))
                        return
                    }

                    Task {
                        do {
                            let tokens = try await self.exchangeCodeViaKinetixServer(code: code)
                            continuation.resume(returning: tokens)
                        } catch {
                            continuation.resume(throwing: error)
                        }
                    }
                }
            )

            authSession?.presentationContextProvider = self
            authSession?.start()
        }
    }

    private func exchangeCodeViaKinetixServer(code: String) async throws -> StravaTokens {
        let url = KinetixEnvironment.webBaseURL.appendingPathComponent("api/strava-oauth")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let payload = StravaOAuthExchangeRequest(code: code, redirect_uri: redirectURI)
        request.httpBody = try JSONEncoder().encode(payload)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw StravaError.authenticationFailed("Invalid response from Kinetix Strava proxy")
        }

        guard http.statusCode == 200 else {
            let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw StravaError.authenticationFailed("Strava token exchange failed (\(http.statusCode)): \(errorMsg)")
        }

        let decoded = try JSONDecoder().decode(StravaServerAuthResponse.self, from: data)
        return StravaTokens(
            accessToken: decoded.access_token,
            refreshToken: decoded.refresh_token,
            expiresAt: Date(timeIntervalSince1970: decoded.expires_at),
            athlete: nil
        )
    }

    public func refreshAccessToken(refreshToken: String) async throws -> StravaTokens {
        let url = KinetixEnvironment.webBaseURL.appendingPathComponent("api/strava-refresh")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let payload = StravaRefreshRequest(refresh_token: refreshToken)
        request.httpBody = try JSONEncoder().encode(payload)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw StravaError.authenticationFailed("Invalid response from Kinetix Strava refresh")
        }

        guard http.statusCode == 200 else {
            let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw StravaError.authenticationFailed("Strava token refresh failed (\(http.statusCode)): \(errorMsg)")
        }

        let decoded = try JSONDecoder().decode(StravaServerAuthResponse.self, from: data)
        return StravaTokens(
            accessToken: decoded.access_token,
            refreshToken: decoded.refresh_token,
            expiresAt: Date(timeIntervalSince1970: decoded.expires_at),
            athlete: nil
        )
    }

    func verifyToken(_ accessToken: String) async -> Bool {
        var request = URLRequest(url: URL(string: "\(apiBase)/athlete")!)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }

    public func fetchActivities(accessToken: String, days: Int = 90) async throws -> [StravaActivity] {
        let now = Date()
        let cutoffDate = now.addingTimeInterval(-Double(days * 24 * 60 * 60))
        let afterTimestamp = Int(cutoffDate.timeIntervalSince1970)

        var page = 1
        var allActivities: [StravaActivity] = []
        var hasMore = true

        while hasMore {
            var components = URLComponents(string: "\(apiBase)/athlete/activities")!
            components.queryItems = [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "per_page", value: "200"),
                URLQueryItem(name: "after", value: "\(afterTimestamp)"),
            ]

            var request = URLRequest(url: components.url!)
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                throw StravaError.networkError("Failed to fetch activities")
            }

            let activities = try JSONDecoder().decode([StravaActivity].self, from: data)

            if activities.isEmpty {
                hasMore = false
            } else {
                let filtered = activities.filter { activity in
                    let activityDate = ISO8601DateFormatter().date(from: activity.start_date) ?? Date()
                    return activityDate >= cutoffDate
                }
                allActivities.append(contentsOf: filtered)

                if activities.count < 200 {
                    hasMore = false
                } else {
                    page += 1
                    try await Task.sleep(nanoseconds: 1_000_000_000)
                }
            }
        }

        return allActivities
    }

    public func uploadActivity(accessToken: String, run: Run) async throws -> StravaActivity {
        let startDate = run.date

        let distanceKm = run.distance / 1000.0
        let durationHours = Int(run.duration) / 3600
        let durationMinutes = (Int(run.duration) % 3600) / 60
        let activityName = "Run - \(String(format: "%.2f", distanceKm)) km"

        var description = "KPS: \(String(format: "%.1f", run.avgNPI))\n"
        description += "Distance: \(String(format: "%.2f", distanceKm)) km\n"
        description += "Duration: \(durationHours):\(String(format: "%02d", durationMinutes))"

        var activityData: [String: Any] = [
            "name": activityName,
            "type": "Run",
            "start_date_local": ISO8601DateFormatter().string(from: startDate),
            "elapsed_time": Int(run.duration),
            "distance": run.distance,
            "description": description,
        ]

        if run.avgHeartRate > 0 {
            activityData["average_heartrate"] = run.avgHeartRate
        }

        if let elevationGain = run.elevationGain, elevationGain > 0 {
            activityData["total_elevation_gain"] = elevationGain
        }

        var request = URLRequest(url: URL(string: "\(apiBase)/activities")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: activityData)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 201 else {
            let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw StravaError.networkError("Failed to upload activity: \(errorMsg)")
        }

        return try JSONDecoder().decode(StravaActivity.self, from: data)
    }
}

private struct StravaOAuthExchangeRequest: Encodable {
    let code: String
    let redirect_uri: String
}

private struct StravaRefreshRequest: Encodable {
    let refresh_token: String
}

private struct StravaServerAuthResponse: Decodable {
    let access_token: String
    let refresh_token: String
    let expires_at: Double
}
