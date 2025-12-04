import Foundation
import Security

/**
 * Secure token storage for cloud storage providers
 * Uses iOS Keychain for secure token storage
 */
class CloudTokenStorage {
    static let shared = CloudTokenStorage()
    
    private let service = "com.kinetix.cloud.tokens"
    
    private init() {}
    
    /**
     * Store tokens for a provider
     */
    func storeTokens(provider: String, accessToken: String, refreshToken: String, expiresIn: TimeInterval) throws {
        let expiresAt = Date().addingTimeInterval(expiresIn)
        
        let tokens = CloudTokens(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: expiresAt,
            tokenType: "Bearer"
        )
        
        let data = try JSONEncoder().encode(tokens)
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: provider,
            kSecValueData as String: data
        ]
        
        // Delete existing item if any
        SecItemDelete(query as CFDictionary)
        
        // Add new item
        let status = SecItemAdd(query as CFDictionary, nil)
        
        guard status == errSecSuccess else {
            throw CloudStorageError.tokenStorageFailed("Failed to store tokens: \(status)")
        }
    }
    
    /**
     * Get tokens for a provider
     */
    func getTokens(provider: String) throws -> CloudTokens? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: provider,
            kSecReturnData as String: true
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess, let data = result as? Data else {
            if status == errSecItemNotFound {
                return nil
            }
            throw CloudStorageError.tokenStorageFailed("Failed to get tokens: \(status)")
        }
        
        return try JSONDecoder().decode(CloudTokens.self, from: data)
    }
    
    /**
     * Update access token (after refresh)
     */
    func updateAccessToken(provider: String, accessToken: String, expiresIn: TimeInterval) throws {
        guard var tokens = try getTokens(provider: provider) else {
            throw CloudStorageError.tokenStorageFailed("No tokens found to update")
        }
        
        tokens.accessToken = accessToken
        tokens.expiresAt = Date().addingTimeInterval(expiresIn)
        
        try storeTokens(
            provider: provider,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: expiresIn
        )
    }
    
    /**
     * Check if tokens exist for a provider
     */
    func hasTokens(provider: String) -> Bool {
        return (try? getTokens(provider: provider)) != nil
    }
    
    /**
     * Remove tokens for a provider
     */
    func removeTokens(provider: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: provider
        ]
        
        let status = SecItemDelete(query as CFDictionary)
        
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw CloudStorageError.tokenStorageFailed("Failed to remove tokens: \(status)")
        }
    }
    
    /**
     * Check if token is valid (not expired or expiring soon)
     */
    func isTokenValid(provider: String) -> Bool {
        guard let tokens = try? getTokens(provider: provider) else {
            return false
        }
        
        // Consider expired if expires in less than 5 minutes
        return tokens.expiresAt > Date().addingTimeInterval(5 * 60)
    }
}

struct CloudTokens: Codable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Date
    var tokenType: String
}

enum CloudStorageError: LocalizedError {
    case tokenStorageFailed(String)
    case authenticationFailed(String)
    case networkError(String)
    case fileNotFound
    case syncFailed(String)
    
    var errorDescription: String? {
        switch self {
        case .tokenStorageFailed(let msg): return "Token storage failed: \(msg)"
        case .authenticationFailed(let msg): return "Authentication failed: \(msg)"
        case .networkError(let msg): return "Network error: \(msg)"
        case .fileNotFound: return "File not found"
        case .syncFailed(let msg): return "Sync failed: \(msg)"
        }
    }
}

