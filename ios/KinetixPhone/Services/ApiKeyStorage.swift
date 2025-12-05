import Foundation
import Security

/**
 * Secure API key storage using iOS Keychain
 * Allows users to "bring their own AI" by storing their own API keys
 */
class ApiKeyStorage {
    static let shared = ApiKeyStorage()
    
    private let service = "com.kinetix.api.keys"
    
    private init() {}
    
    /**
     * Store an API key securely
     */
    func storeKey(name: String, value: String) throws {
        guard !value.isEmpty else {
            // Empty value means remove the key
            try removeKey(name: name)
            return
        }
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: name,
            kSecValueData as String: value.data(using: .utf8)!
        ]
        
        // Delete existing item if any
        SecItemDelete(query as CFDictionary)
        
        // Add new item
        let status = SecItemAdd(query as CFDictionary, nil)
        
        guard status == errSecSuccess else {
            throw ApiKeyStorageError.storageFailed("Failed to store API key: \(status)")
        }
    }
    
    /**
     * Get an API key
     */
    func getKey(name: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: name,
            kSecReturnData as String: true
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess, let data = result as? Data,
              let key = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return key
    }
    
    /**
     * Remove an API key
     */
    func removeKey(name: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: name
        ]
        
        let status = SecItemDelete(query as CFDictionary)
        
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw ApiKeyStorageError.storageFailed("Failed to remove API key: \(status)")
        }
    }
    
    /**
     * Check if an API key exists
     */
    func hasKey(name: String) -> Bool {
        return getKey(name: name) != nil
    }
}

enum ApiKeyStorageError: LocalizedError {
    case storageFailed(String)
    
    var errorDescription: String? {
        switch self {
        case .storageFailed(let msg): return "API key storage failed: \(msg)"
        }
    }
}

