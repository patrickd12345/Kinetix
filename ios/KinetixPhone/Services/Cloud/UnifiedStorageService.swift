import Foundation
import SwiftData
import UIKit

/**
 * Unified Storage Service for iOS
 * Coordinates between SwiftData (local) and cloud storage
 * Single entry point for all storage operations
 */
public class UnifiedStorageService {
    public static let shared = UnifiedStorageService()
    
    private var syncMode: String = "local" // "local" | "cloud-synced"
    private var syncInProgress = false
    
    private init() {
        // Load sync mode from UserDefaults
        syncMode = UserDefaults.standard.string(forKey: "kinetix_sync_mode") ?? "local"
    }
    
    /**
     * Initialize unified storage service
     */
    public func initialize(modelContext: ModelContext) async {
        // If cloud-synced, trigger background sync
        if syncMode == "cloud-synced" {
            let status = CloudSyncService.shared.getSyncStatus()
            if status.isConnected {
                Task {
                    do {
                        _ = try await CloudSyncService.shared.syncRunsFromCloud(modelContext: modelContext)
                    } catch {
                        print("Background sync failed on init: \(error)")
                    }
                }
            }
        }
    }
    
    /**
     * Save a run
     * Always saves to SwiftData first, then syncs to cloud if enabled
     */
    public func saveRun(_ run: Run, modelContext: ModelContext) async throws {
        // Always save to local first (offline-first)
        modelContext.insert(run)
        try modelContext.save()
        
        // If cloud-synced, queue for cloud sync (non-blocking)
        if syncMode == "cloud-synced" {
            Task {
                do {
                    _ = try await CloudSyncService.shared.syncRunsToCloud(modelContext: modelContext)
                } catch {
                    print("Background sync failed for run: \(error)")
                    // Run is saved locally, sync will retry later
                }
            }
        }
    }
    
    /**
     * Get all runs
     * Always reads from SwiftData (fast, offline-capable)
     */
    func getAllRuns(modelContext: ModelContext) throws -> [Run] {
        let descriptor = FetchDescriptor<Run>(sortBy: [SortDescriptor(\.date, order: .reverse)])
        return try modelContext.fetch(descriptor)
    }
    
    /**
     * Get a single run by ID
     */
    func getRun(id: UUID, modelContext: ModelContext) throws -> Run? {
        let descriptor = FetchDescriptor<Run>(
            predicate: #Predicate<Run> { $0.id == id }
        )
        return try modelContext.fetch(descriptor).first
    }
    
    /**
     * Delete a run
     */
    func deleteRun(_ run: Run, modelContext: ModelContext) async throws {
        modelContext.delete(run)
        try modelContext.save()
        
        // If cloud-synced, sync to cloud (run will be removed on next sync)
        if syncMode == "cloud-synced" {
            Task {
                _ = try? await CloudSyncService.shared.syncRunsToCloud(modelContext: modelContext)
            }
        }
    }
    
    /**
     * Enable cloud sync
     */
    public func enableCloudSync(presentingViewController: UIViewController, modelContext: ModelContext) async throws {
        // Authenticate with Google Drive
        try await CloudSyncService.shared.authenticate(presentingViewController: presentingViewController)
        
        // Update sync mode
        syncMode = "cloud-synced"
        UserDefaults.standard.set(syncMode, forKey: "kinetix_sync_mode")
        
        // Initial sync
        _ = try await CloudSyncService.shared.syncRunsToCloud(modelContext: modelContext)
        _ = try await CloudSyncService.shared.syncRunsFromCloud(modelContext: modelContext)
    }
    
    /**
     * Disable cloud sync
     */
    public func disableCloudSync() {
        syncMode = "local"
        UserDefaults.standard.set(syncMode, forKey: "kinetix_sync_mode")
        try? CloudTokenStorage.shared.removeTokens(provider: "google")
    }
    
    /**
     * Manual sync
     */
    public func manualSync(modelContext: ModelContext) async throws -> SyncResult {
        guard syncMode == "cloud-synced" else {
            throw CloudStorageError.syncFailed("Cloud sync not enabled")
        }
        
        // Sync from cloud first (get latest)
        let fromCloud = try await CloudSyncService.shared.syncRunsFromCloud(modelContext: modelContext)
        
        // Then sync to cloud (upload local changes)
        let toCloud = try await CloudSyncService.shared.syncRunsToCloud(modelContext: modelContext)
        
        return SyncResult(
            success: true,
            uploaded: toCloud.uploaded,
            downloaded: fromCloud.downloaded,
            merged: fromCloud.merged,
            total: fromCloud.total
        )
    }
    
    /**
     * Get sync status
     */
    public func getSyncStatus() -> SyncStatus {
        return CloudSyncService.shared.getSyncStatus()
    }
    
    /**
     * Check if cloud sync is enabled
     */
    public func isCloudSyncEnabled() -> Bool {
        return syncMode == "cloud-synced"
    }
}

