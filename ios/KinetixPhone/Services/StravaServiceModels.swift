import Foundation

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

