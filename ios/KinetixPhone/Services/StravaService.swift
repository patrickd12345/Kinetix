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
        var description = "KPS: \(String(format: "%.1f", run.avgNPI))\n"
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

