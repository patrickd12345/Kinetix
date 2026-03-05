import Foundation

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

