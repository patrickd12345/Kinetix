import Foundation
import AuthenticationServices
import UIKit
import CryptoKit
import SwiftData

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

// MARK: - Withings Service

public class WithingsService: NSObject {
    public static let shared = WithingsService()

    private let clientId: String
    private let clientSecret: String
    private let redirectURI = "kinetix://auth/withings"

    private let signatureURL = URL(string: "https://wbsapi.withings.net/v2/signature")!
    private let oauthURL = URL(string: "https://wbsapi.withings.net/v2/oauth2")!
    private let measureURL = URL(string: "https://wbsapi.withings.net/measure")!

    private var authSession: ASWebAuthenticationSession?

    private override init() {
        clientId = Bundle.main.object(forInfoDictionaryKey: "WITHINGS_CLIENT_ID") as? String ?? ""
        clientSecret = Bundle.main.object(forInfoDictionaryKey: "WITHINGS_CLIENT_SECRET") as? String ?? ""

        super.init()

        if clientId.isEmpty || clientSecret.isEmpty {
            print("⚠️ Withings credentials not configured in Info.plist. Add WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET.")
        }
    }

    public func areCredentialsConfigured() -> Bool {
        !clientId.isEmpty && !clientSecret.isEmpty
    }

    private func getAuthorizationURL() -> URL {
        var components = URLComponents(string: "https://account.withings.com/oauth2_user/authorize2")!
        components.queryItems = [
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "scope", value: "user.metrics"),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "state", value: "withings"),
        ]
        return components.url!
    }

    public func authenticate(presentingViewController: UIViewController) async throws -> WithingsTokens {
        guard areCredentialsConfigured() else {
            throw WithingsError.notConfigured("Withings credentials not configured in Info.plist")
        }

        return try await withCheckedThrowingContinuation { continuation in
            let authURL = self.getAuthorizationURL()

            self.authSession = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: "kinetix",
                completionHandler: { [weak self] callbackURL, error in
                    guard let self = self else { return }

                    if let error = error {
                        continuation.resume(throwing: WithingsError.authenticationFailed(error.localizedDescription))
                        return
                    }

                    guard let callbackURL = callbackURL,
                          let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                          let code = components.queryItems?.first(where: { $0.name == "code" })?.value else {
                        continuation.resume(throwing: WithingsError.authenticationFailed("No authorization code received"))
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

            self.authSession?.presentationContextProvider = self
            self.authSession?.start()
        }
    }

    private func exchangeCodeForToken(code: String) async throws -> WithingsTokens {
        try await requestToken(grantType: "authorization_code", code: code, refreshToken: nil)
    }

    public func refreshAccessToken(refreshToken: String) async throws -> WithingsTokens {
        try await requestToken(grantType: "refresh_token", code: nil, refreshToken: refreshToken)
    }

    public func ensureValidAccessToken() async throws -> WithingsTokens {
        guard let stored = try CloudTokenStorage.shared.getTokens(provider: "withings") else {
            throw WithingsError.notConnected("Withings is not connected")
        }

        if stored.expiresAt > Date().addingTimeInterval(5 * 60) {
            return WithingsTokens(
                accessToken: stored.accessToken,
                refreshToken: stored.refreshToken,
                expiresAt: stored.expiresAt,
                userId: nil
            )
        }

        let refreshed = try await refreshAccessToken(refreshToken: stored.refreshToken)
        try CloudTokenStorage.shared.storeTokens(
            provider: "withings",
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            expiresAt: refreshed.expiresAt
        )
        return refreshed
    }

    private func requestToken(grantType: String, code: String?, refreshToken: String?) async throws -> WithingsTokens {
        let nonce = try await getNonce()
        let signature = withingsHmacHex(message: "requesttoken,\(clientId),\(nonce)")

        var params: [String: String] = [
            "action": "requesttoken",
            "grant_type": grantType,
            "client_id": clientId,
            "nonce": nonce,
            "signature": signature,
        ]

        if grantType == "authorization_code" {
            guard let code = code else {
                throw WithingsError.authenticationFailed("Missing authorization code")
            }
            params["code"] = code
            params["redirect_uri"] = redirectURI
        } else {
            guard let refreshToken = refreshToken else {
                throw WithingsError.authenticationFailed("Missing refresh token")
            }
            params["refresh_token"] = refreshToken
        }

        var request = URLRequest(url: oauthURL)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = urlEncodedBody(params)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw WithingsError.networkError("Invalid token response")
        }

        guard httpResponse.statusCode == 200 else {
            throw WithingsError.authenticationFailed(parseWithingsError(data: data, fallback: "Withings token exchange failed"))
        }

        let json = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any]
        let status = json?["status"] as? Int ?? -1
        guard status == 0 else {
            let message = parseWithingsBodyError(json) ?? parseWithingsError(data: data, fallback: "Withings token error")
            throw WithingsError.authenticationFailed(message)
        }

        guard let body = json?["body"] as? [String: Any],
              let accessToken = body["access_token"] as? String,
              let refreshedToken = body["refresh_token"] as? String else {
            throw WithingsError.authenticationFailed("Withings token response missing access/refresh token")
        }

        let expiresIn = (body["expires_in"] as? Int) ?? 10_800
        let userId = (body["userid"] as? NSNumber)?.stringValue ?? body["userid"] as? String

        return WithingsTokens(
            accessToken: accessToken,
            refreshToken: refreshedToken,
            expiresAt: Date().addingTimeInterval(TimeInterval(expiresIn)),
            userId: userId
        )
    }

    private func getNonce() async throws -> String {
        let timestamp = Int(Date().timeIntervalSince1970)
        let signature = withingsHmacHex(message: "getnonce,\(clientId),\(timestamp)")

        let params: [String: String] = [
            "action": "getnonce",
            "client_id": clientId,
            "timestamp": "\(timestamp)",
            "signature": signature,
        ]

        var request = URLRequest(url: signatureURL)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = urlEncodedBody(params)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw WithingsError.networkError("Invalid nonce response")
        }

        guard httpResponse.statusCode == 200 else {
            throw WithingsError.authenticationFailed(parseWithingsError(data: data, fallback: "Withings nonce request failed"))
        }

        let json = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any]
        let status = json?["status"] as? Int ?? -1
        guard status == 0 else {
            let message = parseWithingsBodyError(json) ?? parseWithingsError(data: data, fallback: "Withings getnonce failed")
            throw WithingsError.authenticationFailed(message)
        }

        guard let body = json?["body"] as? [String: Any],
              let nonce = body["nonce"] as? String,
              !nonce.isEmpty else {
            throw WithingsError.authenticationFailed("Withings nonce missing in response")
        }

        return nonce
    }

    public func fetchLatestWeightKg(accessToken: String) async throws -> Double? {
        let samples = try await fetchRecentWeightSamples(accessToken: accessToken, daysBack: 365)
        return samples.first?.kg
    }

    public func fetchRecentWeightSamples(accessToken: String, daysBack: Int = 30) async throws -> [WithingsWeightSample] {
        let end = Int(Date().timeIntervalSince1970)
        let start = end - max(1, daysBack) * 24 * 3600

        let params: [String: String] = [
            "action": "getmeas",
            "startdate": "\(start)",
            "enddate": "\(end)",
            "meastypes": "1",
        ]

        var request = URLRequest(url: measureURL)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = urlEncodedBody(params)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw WithingsError.networkError("Invalid measure response")
        }

        guard httpResponse.statusCode == 200 else {
            throw WithingsError.networkError(parseWithingsError(data: data, fallback: "Withings measure request failed"))
        }

        let json = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any]
        let status = json?["status"] as? Int ?? -1
        guard status == 0 else {
            let message = parseWithingsBodyError(json) ?? parseWithingsError(data: data, fallback: "Withings measure error")
            throw WithingsError.networkError(message)
        }

        guard let body = json?["body"] as? [String: Any],
              let groups = body["measuregrps"] as? [[String: Any]] else {
            return []
        }

        var out: [WithingsWeightSample] = []
        for group in groups {
            let dateUnix: Int
            if let d = group["date"] as? Int {
                dateUnix = d
            } else if let dString = group["date"] as? String, let parsed = Int(dString) {
                dateUnix = parsed
            } else {
                continue
            }

            guard let measures = group["measures"] as? [[String: Any]] else {
                continue
            }

            guard let weightMeasure = measures.first(where: { ($0["type"] as? Int) == 1 }) else {
                continue
            }

            guard let value = parseDouble(weightMeasure["value"]) else { continue }
            let unitExponent = Int(parseDouble(weightMeasure["unit"]) ?? -2)
            let kg = value * pow(10.0, Double(unitExponent))
            let roundedKg = (kg * 100).rounded() / 100
            out.append(
                WithingsWeightSample(
                    dateUnix: dateUnix,
                    recordedAt: Date(timeIntervalSince1970: TimeInterval(dateUnix)),
                    kg: roundedKg
                )
            )
        }

        return out.sorted(by: { $0.dateUnix > $1.dateUnix })
    }

    @MainActor
    public func syncRecentWeights(modelContext: ModelContext, daysBack: Int = 30) async throws -> (imported: Int, latestKg: Double?) {
        let tokens = try await ensureValidAccessToken()
        let samples = try await fetchRecentWeightSamples(accessToken: tokens.accessToken, daysBack: daysBack)
        let imported = try upsertWeightSamples(samples, modelContext: modelContext)
        return (imported, samples.first?.kg)
    }

    @MainActor
    public func importWeightSamples(_ samples: [WithingsWeightSample], modelContext: ModelContext) throws -> Int {
        try upsertWeightSamples(samples, modelContext: modelContext)
    }

    @MainActor
    private func upsertWeightSamples(_ samples: [WithingsWeightSample], modelContext: ModelContext) throws -> Int {
        guard !samples.isEmpty else { return 0 }

        var insertedCount = 0
        for sample in samples {
            let unix = sample.dateUnix
            let descriptor = FetchDescriptor<WeightEntry>(
                predicate: #Predicate { $0.dateUnix == unix }
            )

            if let existing = try modelContext.fetch(descriptor).first {
                existing.recordedAt = sample.recordedAt
                existing.kg = sample.kg
            } else {
                let entry = WeightEntry(dateUnix: sample.dateUnix, recordedAt: sample.recordedAt, kg: sample.kg)
                modelContext.insert(entry)
                insertedCount += 1
            }
        }

        try modelContext.save()
        return insertedCount
    }

    private func withingsHmacHex(message: String) -> String {
        let key = SymmetricKey(data: Data(clientSecret.utf8))
        let messageData = Data(message.utf8)
        let signature = HMAC<SHA256>.authenticationCode(for: messageData, using: key)
        return signature.map { String(format: "%02x", $0) }.joined()
    }

    private func urlEncodedBody(_ params: [String: String]) -> Data? {
        var components = URLComponents()
        components.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }
        return components.percentEncodedQuery?.data(using: .utf8)
    }

    private func parseWithingsBodyError(_ json: [String: Any]?) -> String? {
        guard let body = json?["body"] as? [String: Any] else { return nil }
        if let message = body["error"] as? String, !message.isEmpty {
            return message
        }
        if let message = body["message"] as? String, !message.isEmpty {
            return message
        }
        return nil
    }

    private func parseWithingsError(data: Data, fallback: String) -> String {
        if let json = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
            if let topLevel = json["error"] as? String, !topLevel.isEmpty {
                return topLevel
            }
            if let bodyError = parseWithingsBodyError(json) {
                return bodyError
            }
        }
        if let text = String(data: data, encoding: .utf8), !text.isEmpty {
            return text
        }
        return fallback
    }

    private func parseDouble(_ value: Any?) -> Double? {
        if let doubleValue = value as? Double { return doubleValue }
        if let intValue = value as? Int { return Double(intValue) }
        if let numberValue = value as? NSNumber { return numberValue.doubleValue }
        if let stringValue = value as? String { return Double(stringValue) }
        return nil
    }
}

extension WithingsService: ASWebAuthenticationPresentationContextProviding {
    @MainActor
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
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

public struct WithingsTokens {
    public let accessToken: String
    public let refreshToken: String
    public let expiresAt: Date
    public let userId: String?
}

public struct WithingsWeightSample {
    public let dateUnix: Int
    public let recordedAt: Date
    public let kg: Double
}

public enum WithingsError: LocalizedError {
    case notConfigured(String)
    case notConnected(String)
    case authenticationFailed(String)
    case networkError(String)

    public var errorDescription: String? {
        switch self {
        case .notConfigured(let msg): return msg
        case .notConnected(let msg): return msg
        case .authenticationFailed(let msg): return msg
        case .networkError(let msg): return msg
        }
    }
}
