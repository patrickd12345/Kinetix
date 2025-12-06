import Foundation
import AuthenticationServices
import UIKit

/**
 * Strava API Service for iOS
 * Handles authentication and data operations with Strava
 */
public class StravaService: NSObject {
    public static let shared = StravaService()
    
    private let clientId: String
    private let clientSecret: String
    private let apiBase = "https://www.strava.com/api/v3"
    private let redirectURI = "kinetix://auth/strava"
    
    private var authSession: ASWebAuthenticationSession?
    private var authContinuation: CheckedContinuation<StravaTokens, Error>?
    
    private override init() {
        // Get from Info.plist - app credentials configured by developer, not user
        clientId = Bundle.main.object(forInfoDictionaryKey: "STRAVA_CLIENT_ID") as? String ?? ""
        clientSecret = Bundle.main.object(forInfoDictionaryKey: "STRAVA_CLIENT_SECRET") as? String ?? ""
        
        super.init()
        
        if clientId.isEmpty || clientSecret.isEmpty {
            print("⚠️ Strava credentials not configured in Info.plist. Please add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET.")
        }
    }
    
    /**
     * Check if Strava credentials are configured
     */
    public func areCredentialsConfigured() -> Bool {
        return !clientId.isEmpty && !clientSecret.isEmpty
    }
    
    /**
     * Get OAuth authorization URL
     */
    private func getAuthorizationURL() -> URL {
        var components = URLComponents(string: "https://www.strava.com/oauth/authorize")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "activity:read_all,activity:write"),
            URLQueryItem(name: "approval_prompt", value: "force"),
        ]
        return components.url!
    }
    
    /**
     * Authenticate with Strava using ASWebAuthenticationSession
     * Automatically opens Strava OAuth dialog - user just needs to authorize
     */
    public func authenticate(presentingViewController: UIViewController) async throws -> StravaTokens {
        guard areCredentialsConfigured() else {
            throw StravaError.notConfigured("Strava credentials not configured in Info.plist")
        }
        
        return try await withCheckedThrowingContinuation { continuation in
            self.authContinuation = continuation
            
            let authURL = getAuthorizationURL()
            
            self.authSession = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: "kinetix",
                completionHandler: { [weak self] callbackURL, error in
                    guard let self = self else { return }
                    
                    if let error = error {
                        continuation.resume(throwing: StravaError.authenticationFailed(error.localizedDescription))
                        return
                    }
                    
                    guard let callbackURL = callbackURL,
                          let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                          let code = components.queryItems?.first(where: { $0.name == "code" })?.value else {
                        continuation.resume(throwing: StravaError.authenticationFailed("No authorization code received"))
                        return
                    }
                    
                    Task {
                        do {
                            let tokens = try await self.exchangeCodeForToken(code: code)
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
    
    /**
     * Exchange authorization code for access token
     */
    private func exchangeCodeForToken(code: String) async throws -> StravaTokens {
        guard !clientId.isEmpty, !clientSecret.isEmpty else {
            throw StravaError.notConfigured("Strava credentials not configured in Info.plist")
        }
        
        var request = URLRequest(url: URL(string: "https://www.strava.com/oauth/token")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "client_id": clientId,
            "client_secret": clientSecret,
            "code": code,
            "grant_type": "authorization_code",
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw StravaError.authenticationFailed("Token exchange failed: \(errorMsg)")
        }
        
        let tokenResponse = try JSONDecoder().decode(StravaTokenResponse.self, from: data)
        
        return StravaTokens(
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token ?? "",
            expiresAt: Date().addingTimeInterval(TimeInterval(tokenResponse.expires_in)),
            athlete: tokenResponse.athlete
        )
    }
    
    /**
     * Refresh access token
     */
    public func refreshAccessToken(refreshToken: String) async throws -> StravaTokens {
        var request = URLRequest(url: URL(string: "https://www.strava.com/oauth/token")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "client_id": clientId,
            "client_secret": clientSecret,
            "refresh_token": refreshToken,
            "grant_type": "refresh_token",
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw StravaError.authenticationFailed("Token refresh failed")
        }
        
        let tokenResponse = try JSONDecoder().decode(StravaTokenResponse.self, from: data)
        
        return StravaTokens(
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token ?? "",
            expiresAt: Date().addingTimeInterval(TimeInterval(tokenResponse.expires_in)),
            athlete: tokenResponse.athlete
        )
    }
    
    /**
     * Verify token is valid
     */
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
    
    /**
     * Fetch activities from Strava
     */
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
                // Filter to only include activities within date range
                let filtered = activities.filter { activity in
                    let activityDate = ISO8601DateFormatter().date(from: activity.start_date) ?? Date()
                    return activityDate >= cutoffDate
                }
                allActivities.append(contentsOf: filtered)
                
                if activities.count < 200 {
                    hasMore = false
                } else {
                    page += 1
                    // Rate limiting: wait 1 second between pages
                    try await Task.sleep(nanoseconds: 1_000_000_000)
                }
            }
        }
        
        return allActivities
    }
    
    /**
     * Upload a run to Strava
     */
    public func uploadActivity(accessToken: String, run: Run) async throws -> StravaActivity {
        let startDate = run.date
        
        // Build activity name
        let distanceKm = run.distance / 1000.0
        let durationHours = Int(run.duration) / 3600
        let durationMinutes = (Int(run.duration) % 3600) / 60
        let activityName = "Run - \(String(format: "%.2f", distanceKm)) km"
        
        // Build description with NPI
        var description = "NPI: \(String(format: "%.1f", run.avgNPI))\n"
        description += "Distance: \(String(format: "%.2f", distanceKm)) km\n"
        description += "Duration: \(durationHours):\(String(format: "%02d", durationMinutes))"
        
        // Prepare activity data
        var activityData: [String: Any] = [
            "name": activityName,
            "type": "Run",
            "start_date_local": ISO8601DateFormatter().string(from: startDate),
            "elapsed_time": Int(run.duration),
            "distance": run.distance,
            "description": description,
        ]
        
        // Add optional fields
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
        
        let activity = try JSONDecoder().decode(StravaActivity.self, from: data)
        return activity
    }
}

// MARK: - ASWebAuthenticationPresentationContextProviding
extension StravaService: ASWebAuthenticationPresentationContextProviding {
    @MainActor
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        // Ensure UIKit access happens on the main thread to avoid warnings
        if Thread.isMainThread {
            return UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .first { $0.isKeyWindow } ?? UIWindow()
        } else {
            var anchor: ASPresentationAnchor = UIWindow()
            DispatchQueue.main.sync {
                anchor = UIApplication.shared.connectedScenes
                    .compactMap { $0 as? UIWindowScene }
                    .flatMap { $0.windows }
                    .first { $0.isKeyWindow } ?? UIWindow()
            }
            return anchor
        }
    }
}

// MARK: - Models

public struct StravaTokens {
    public let accessToken: String
    public let refreshToken: String
    public let expiresAt: Date
    public let athlete: StravaAthlete?
    
    public init(accessToken: String, refreshToken: String, expiresAt: Date, athlete: StravaAthlete?) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
        self.athlete = athlete
    }
}

struct StravaTokenResponse: Codable {
    let access_token: String
    let refresh_token: String?
    let expires_in: Int
    let athlete: StravaAthlete?
}

public struct StravaAthlete: Codable {
    public let id: Int
    public let username: String?
    public let firstname: String?
    public let lastname: String?
    
    public init(id: Int, username: String?, firstname: String?, lastname: String?) {
        self.id = id
        self.username = username
        self.firstname = firstname
        self.lastname = lastname
    }
}

public struct StravaActivity: Codable {
    public let id: Int
    public let name: String
    public let distance: Double
    public let moving_time: Int
    public let elapsed_time: Int
    public let start_date: String
    public let type: String
    public let sport_type: String?
    public let average_heartrate: Double?
    public let average_cadence: Double?
    public let total_elevation_gain: Double?
    public let description: String?
    
    public init(id: Int, name: String, distance: Double, moving_time: Int, elapsed_time: Int, start_date: String, type: String, sport_type: String?, average_heartrate: Double?, average_cadence: Double?, total_elevation_gain: Double?, description: String?) {
        self.id = id
        self.name = name
        self.distance = distance
        self.moving_time = moving_time
        self.elapsed_time = elapsed_time
        self.start_date = start_date
        self.type = type
        self.sport_type = sport_type
        self.average_heartrate = average_heartrate
        self.average_cadence = average_cadence
        self.total_elevation_gain = total_elevation_gain
        self.description = description
    }
}

public enum StravaError: LocalizedError {
    case notConfigured(String)
    case authenticationFailed(String)
    case networkError(String)
    
    public var errorDescription: String? {
        switch self {
        case .notConfigured(let msg): return msg
        case .authenticationFailed(let msg): return msg
        case .networkError(let msg): return msg
        }
    }
}
