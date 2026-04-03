import Foundation
import AuthenticationServices
import UIKit
import CryptoKit
import SwiftData

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

    private func getMeasMoreFlag(_ body: [String: Any]) -> Bool {
        if let m = body["more"] as? Int { return m == 1 }
        if let m = body["more"] as? Bool { return m }
        return false
    }

    /// Parses one page of measure groups into samples (shared by range and lastupdate fetches).
    private func parseMeasureGroupsToSamples(_ groups: [[String: Any]]) -> [WithingsWeightSample] {
        var pageSamples: [WithingsWeightSample] = []
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
            pageSamples.append(
                WithingsWeightSample(
                    dateUnix: dateUnix,
                    recordedAt: Date(timeIntervalSince1970: TimeInterval(dateUnix)),
                    kg: roundedKg
                )
            )
        }
        return pageSamples
    }

    /// Withings `getmeas` returns one page; follow `more` / `offset` until all rows for the date range are fetched. Uses `category=1` (real measures).
    public func fetchRecentWeightSamples(accessToken: String, daysBack: Int = 30) async throws -> [WithingsWeightSample] {
        let end = Int(Date().timeIntervalSince1970)
        let start = end - max(1, daysBack) * 24 * 3600

        var allOut: [WithingsWeightSample] = []
        var requestOffset = 0
        let maxPages = 250

        for _ in 0..<maxPages {
            var params: [String: String] = [
                "action": "getmeas",
                "category": "1",
                "startdate": "\(start)",
                "enddate": "\(end)",
                "meastypes": "1",
            ]
            if requestOffset > 0 {
                params["offset"] = "\(requestOffset)"
            }

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

            guard let body = json?["body"] as? [String: Any] else {
                break
            }

            let groups = body["measuregrps"] as? [[String: Any]] ?? []
            let pageSamples = parseMeasureGroupsToSamples(groups)
            allOut.append(contentsOf: pageSamples)

            let more = getMeasMoreFlag(body)
            let nextRaw = body["offset"]
            let nextOffset: Int? = {
                if let n = nextRaw as? Int { return n }
                if let n = nextRaw as? Double { return Int(n) }
                return nil
            }()
            if !more {
                break
            }
            guard let next = nextOffset, next != requestOffset else {
                break
            }
            requestOffset = next
        }

        return allOut.sorted(by: { $0.dateUnix > $1.dateUnix })
    }

    /// Incremental `getmeas` using `lastupdate` only (no start/end). Merged on the phone with the date-range pull.
    private func fetchWeightSamplesSinceLastUpdate(accessToken: String, lastUpdateUnix: Int) async throws -> [WithingsWeightSample] {
        var allOut: [WithingsWeightSample] = []
        var requestOffset = 0
        let maxPages = 250

        for _ in 0..<maxPages {
            var params: [String: String] = [
                "action": "getmeas",
                "category": "1",
                "lastupdate": "\(lastUpdateUnix)",
                "meastypes": "1",
            ]
            if requestOffset > 0 {
                params["offset"] = "\(requestOffset)"
            }

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

            guard let body = json?["body"] as? [String: Any] else {
                break
            }

            let groups = body["measuregrps"] as? [[String: Any]] ?? []
            allOut.append(contentsOf: parseMeasureGroupsToSamples(groups))

            let more = getMeasMoreFlag(body)
            let nextRaw = body["offset"]
            let nextOffset: Int? = {
                if let n = nextRaw as? Int { return n }
                if let n = nextRaw as? Double { return Int(n) }
                return nil
            }()
            if !more {
                break
            }
            guard let next = nextOffset, next != requestOffset else {
                break
            }
            requestOffset = next
        }

        return allOut.sorted(by: { $0.dateUnix > $1.dateUnix })
    }

    private func mergeWeightSamples(_ range: [WithingsWeightSample], _ since: [WithingsWeightSample]) -> [WithingsWeightSample] {
        var dict: [Int: WithingsWeightSample] = [:]
        for s in range { dict[s.dateUnix] = s }
        for s in since { dict[s.dateUnix] = s }
        return dict.values.sorted { $0.dateUnix > $1.dateUnix }
    }

    @MainActor
    public func syncRecentWeights(modelContext: ModelContext, daysBack: Int = 30) async throws -> (imported: Int, latestKg: Double?) {
        let tokens = try await ensureValidAccessToken()
        var rangeSamples = try await fetchRecentWeightSamples(accessToken: tokens.accessToken, daysBack: daysBack)

        let maxDesc = FetchDescriptor<WeightEntry>(sortBy: [SortDescriptor(\WeightEntry.dateUnix, order: .reverse)])
        let maxLocal = try modelContext.fetch(maxDesc).first?.dateUnix

        if let m = maxLocal, m > 0 {
            let sinceSamples = try await fetchWeightSamplesSinceLastUpdate(accessToken: tokens.accessToken, lastUpdateUnix: m)
            rangeSamples = mergeWeightSamples(rangeSamples, sinceSamples)
        }

        let imported = try upsertWeightSamples(rangeSamples, modelContext: modelContext)
        return (imported, rangeSamples.first?.kg)
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

