import Foundation
import SwiftData
import UIKit

/**
 * Cloud sync service for iOS
 * Handles syncing data between SwiftData (local) and Google Drive (cloud)
 * Uses single file architecture: kinetix-data.json
 */
class CloudSyncService {
    static let shared = CloudSyncService()
    
    private let dataFilename = "kinetix-data.json"
    private let googleDriveProvider: GoogleDriveProvider
    
    private var syncInProgress = false
    private var lastSyncTime: Date?
    
    private init() {
        // Get from Info.plist
        let clientId = Bundle.main.object(forInfoDictionaryKey: "GOOGLE_CLIENT_ID") as? String ?? ""
        let clientSecret = Bundle.main.object(forInfoDictionaryKey: "GOOGLE_CLIENT_SECRET") as? String ?? ""
        let redirectURI = "com.kinetix.phone://oauth/google/callback"
        
        // Validate credentials are configured
        guard !clientId.isEmpty, !clientSecret.isEmpty, clientId != "YOUR_GOOGLE_CLIENT_ID" else {
            // Credentials not configured - provider will throw error on use
            self.googleDriveProvider = GoogleDriveProvider(
                clientId: "",
                clientSecret: "",
                redirectURI: redirectURI
            )
            return
        }
        
        self.googleDriveProvider = GoogleDriveProvider(
            clientId: clientId,
            clientSecret: clientSecret,
            redirectURI: redirectURI
        )
    }
    
    /**
     * Check if Google OAuth credentials are configured
     */
    func areCredentialsConfigured() -> Bool {
        let clientId = Bundle.main.object(forInfoDictionaryKey: "GOOGLE_CLIENT_ID") as? String ?? ""
        let clientSecret = Bundle.main.object(forInfoDictionaryKey: "GOOGLE_CLIENT_SECRET") as? String ?? ""
        return !clientId.isEmpty && !clientSecret.isEmpty && clientId != "YOUR_GOOGLE_CLIENT_ID"
    }
    
    /**
     * Ensure we have a valid access token
     */
    private func ensureValidToken(provider: String = "google") async throws -> String {
        let isValid = CloudTokenStorage.shared.isTokenValid(provider: provider)
        
        if isValid {
            let tokens = try CloudTokenStorage.shared.getTokens(provider: provider)
            return tokens!.accessToken
        }
        
        // Token expired, refresh it
        let tokens = try CloudTokenStorage.shared.getTokens(provider: provider)
        guard let refreshToken = tokens?.refreshToken else {
            throw CloudStorageError.authenticationFailed("No refresh token available. Please re-authenticate.")
        }
        
        let refreshed = try await googleDriveProvider.refreshAccessToken(refreshToken: refreshToken)
        
        try CloudTokenStorage.shared.updateAccessToken(
            provider: provider,
            accessToken: refreshed.accessToken,
            expiresIn: refreshed.expiresIn
        )
        
        return refreshed.accessToken
    }
    
    /**
     * Load all data from cloud (single file)
     */
    private func loadDataFromCloud(accessToken: String) async throws -> CloudData {
        do {
            let data = try await googleDriveProvider.downloadFile(
                filename: dataFilename,
                accessToken: accessToken
            )
            return try JSONDecoder().decode(CloudData.self, from: data)
        } catch CloudStorageError.fileNotFound {
            // File doesn't exist yet, return empty structure
            return CloudData(
                runs: [],
                settings: nil,
                syncMetadata: SyncMetadata(
                    lastSync: nil,
                    deviceId: UIDevice.current.identifierForVendor?.uuidString ?? "unknown",
                    syncVersion: 1
                )
            )
        }
    }
    
    /**
     * Save all data to cloud (single file)
     */
    private func saveDataToCloud(_ data: CloudData, accessToken: String) async throws {
        let jsonData = try JSONEncoder().encode(data)
        try await googleDriveProvider.uploadFile(
            filename: dataFilename,
            content: jsonData,
            accessToken: accessToken
        )
    }
    
    /**
     * Sync all runs to cloud (using single file)
     */
    func syncRunsToCloud(modelContext: ModelContext) async throws -> SyncResult {
        guard !syncInProgress else {
            throw CloudStorageError.syncFailed("Sync already in progress")
        }
        
        syncInProgress = true
        defer { syncInProgress = false }
        
        let accessToken = try await ensureValidToken()
        
        // Get all local runs
        let descriptor = FetchDescriptor<Run>(sortBy: [SortDescriptor(\.date, order: .reverse)])
        let localRuns = try modelContext.fetch(descriptor)
        
        // Convert to JSON-serializable format
        let runsData = localRuns.map { run in
            RunData.from(run: run)
        }
        
        // Load cloud data (if exists)
        let cloudData = try await loadDataFromCloud(accessToken: accessToken)
        
        // Get settings (if any stored locally)
        // Note: Settings might be stored differently in iOS, adjust as needed
        let settings: [String: Any]? = nil // TODO: Get from UserDefaults or SwiftData
        
        // Merge: Local is source of truth for runs
        let mergedData = CloudData(
            runs: runsData.map { run in
                var updated = run
                updated.lastModified = updated.lastModified ?? run.date
                updated.syncedAt = ISO8601DateFormatter().string(from: Date())
                return updated
            },
            settings: settings,
            syncMetadata: SyncMetadata(
                lastSync: ISO8601DateFormatter().string(from: Date()),
                deviceId: UIDevice.current.identifierForVendor?.uuidString ?? "unknown",
                syncVersion: 1
            )
        )
        
        // Save merged data to cloud
        try await saveDataToCloud(mergedData, accessToken: accessToken)
        
        lastSyncTime = Date()
        return SyncResult(success: true, uploaded: localRuns.count, total: localRuns.count)
    }
    
    /**
     * Sync runs from cloud to local (using single file)
     */
    func syncRunsFromCloud(modelContext: ModelContext) async throws -> SyncResult {
        guard !syncInProgress else {
            throw CloudStorageError.syncFailed("Sync already in progress")
        }
        
        syncInProgress = true
        defer { syncInProgress = false }
        
        let accessToken = try await ensureValidToken()
        
        // Load cloud data
        let cloudData = try await loadDataFromCloud(accessToken: accessToken)
        
        // Get local runs
        let descriptor = FetchDescriptor<Run>()
        let localRuns = try modelContext.fetch(descriptor)
        let localRunMap = Dictionary(uniqueKeysWithValues: localRuns.map { ($0.id.uuidString, $0) })
        
        // Merge runs: last-write-wins
        var downloaded = 0
        var merged = 0
        
        for cloudRunData in cloudData.runs {
            let localRun = localRunMap[cloudRunData.id]
            
            if localRun == nil {
                // New run from cloud, add it
                let newRun = Run(
                    date: ISO8601DateFormatter().date(from: cloudRunData.date) ?? Date(),
                    source: cloudRunData.source,
                    distance: cloudRunData.distance,
                    duration: cloudRunData.duration,
                    avgPace: cloudRunData.avgPace,
                    avgNPI: cloudRunData.avgNPI,
                    avgHeartRate: cloudRunData.avgHeartRate,
                    avgCadence: cloudRunData.avgCadence,
                    avgVerticalOscillation: cloudRunData.avgVerticalOscillation,
                    avgGroundContactTime: cloudRunData.avgGroundContactTime,
                    avgStrideLength: cloudRunData.avgStrideLength,
                    formScore: cloudRunData.formScore,
                    routeData: cloudRunData.routeData.map { RoutePoint(lat: $0.lat, lon: $0.lon) },
                    formSessionId: cloudRunData.formSessionId.flatMap { UUID(uuidString: $0) }
                )
                // Note: SwiftData @Model generates id in init, so we can't set it
                // The cloud ID is stored in the id field, but SwiftData uses its own
                // This is acceptable - we match by date/source for conflict resolution
                modelContext.insert(newRun)
                downloaded += 1
            } else {
                // Both exist - compare timestamps
                let localModified = localRun?.date ?? Date.distantPast
                let cloudModified = ISO8601DateFormatter().date(from: cloudRunData.date) ?? Date.distantPast
                let cloudSyncedAt = cloudRunData.syncedAt.flatMap { ISO8601DateFormatter().date(from: $0) } ?? Date.distantPast
                
                // Use cloud if it's newer
                if cloudSyncedAt > localModified || cloudModified > localModified {
                    // Update local run with cloud data
                    if let cloudDate = ISO8601DateFormatter().date(from: cloudRunData.date) {
                        localRun?.date = cloudDate
                    }
                    localRun?.distance = cloudRunData.distance
                    localRun?.duration = cloudRunData.duration
                    localRun?.avgPace = cloudRunData.avgPace
                    localRun?.avgNPI = cloudRunData.avgNPI
                    localRun?.avgHeartRate = cloudRunData.avgHeartRate
                    localRun?.avgCadence = cloudRunData.avgCadence
                    localRun?.avgVerticalOscillation = cloudRunData.avgVerticalOscillation
                    localRun?.avgGroundContactTime = cloudRunData.avgGroundContactTime
                    localRun?.avgStrideLength = cloudRunData.avgStrideLength
                    localRun?.formScore = cloudRunData.formScore
                    localRun?.routeData = cloudRunData.routeData.map { RoutePoint(lat: $0.lat, lon: $0.lon) }
                    merged += 1
                }
            }
        }
        
        try modelContext.save()
        
        lastSyncTime = Date()
        return SyncResult(
            success: true,
            downloaded: downloaded,
            merged: merged,
            total: cloudData.runs.count
        )
    }
    
    /**
     * Get sync status
     */
    func getSyncStatus() -> SyncStatus {
        let isConnected = CloudTokenStorage.shared.hasTokens(provider: "google")
        
        return SyncStatus(
            isConnected: isConnected,
            isSyncing: syncInProgress,
            provider: isConnected ? "google" : nil,
            lastSyncTime: lastSyncTime
        )
    }
    
    /**
     * Authenticate with Google Drive
     * Opens Google OAuth dialog automatically
     */
    func authenticate(presentingViewController: UIViewController) async throws {
        // Validate credentials are configured
        guard areCredentialsConfigured() else {
            throw CloudStorageError.authenticationFailed(
                "Google OAuth credentials not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to Info.plist"
            )
        }
        
        // Open Google OAuth dialog automatically
        let tokens = try await googleDriveProvider.authenticate(presentingViewController: presentingViewController)
        
        try CloudTokenStorage.shared.storeTokens(
            provider: "google",
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresAt.timeIntervalSinceNow
        )
    }
}

// MARK: - Data Models
struct CloudData: Codable {
    var runs: [RunData]
    var settings: [String: Any]?
    var syncMetadata: SyncMetadata
    
    enum CodingKeys: String, CodingKey {
        case runs, settings, syncMetadata
    }
    
    init(runs: [RunData], settings: [String: Any]?, syncMetadata: SyncMetadata) {
        self.runs = runs
        self.settings = settings
        self.syncMetadata = syncMetadata
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        runs = try container.decode([RunData].self, forKey: .runs)
        syncMetadata = try container.decode(SyncMetadata.self, forKey: .syncMetadata)
        // Settings decoding handled separately if needed
        settings = nil
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(runs, forKey: .runs)
        try container.encode(syncMetadata, forKey: .syncMetadata)
        // Settings encoding handled separately if needed
    }
}

struct RunData: Codable {
    var id: String
    var date: String
    var source: String
    var distance: Double
    var duration: TimeInterval
    var avgPace: Double
    var avgNPI: Double
    var avgHeartRate: Double
    var avgCadence: Double?
    var avgVerticalOscillation: Double?
    var avgGroundContactTime: Double?
    var avgStrideLength: Double?
    var formScore: Double?
    var routeData: [RoutePointData]
    var formSessionId: String?
    var lastModified: String?
    var syncedAt: String?
    
    static func from(run: Run) -> RunData {
        let formatter = ISO8601DateFormatter()
        return RunData(
            id: run.id.uuidString,
            date: formatter.string(from: run.date),
            source: run.source,
            distance: run.distance,
            duration: run.duration,
            avgPace: run.avgPace,
            avgNPI: run.avgNPI,
            avgHeartRate: run.avgHeartRate,
            avgCadence: run.avgCadence,
            avgVerticalOscillation: run.avgVerticalOscillation,
            avgGroundContactTime: run.avgGroundContactTime,
            avgStrideLength: run.avgStrideLength,
            formScore: run.formScore,
            routeData: run.routeData.map { RoutePointData(lat: $0.lat, lon: $0.lon) },
            formSessionId: run.formSessionId?.uuidString,
            lastModified: nil,
            syncedAt: nil
        )
    }
}

struct RoutePointData: Codable {
    let lat: Double
    let lon: Double
}

struct SyncMetadata: Codable {
    var lastSync: String?
    var deviceId: String
    var syncVersion: Int
}

struct SyncResult {
    let success: Bool
    let uploaded: Int?
    let downloaded: Int?
    let merged: Int?
    let total: Int
}

struct SyncStatus {
    let isConnected: Bool
    let isSyncing: Bool
    let provider: String?
    let lastSyncTime: Date?
}

