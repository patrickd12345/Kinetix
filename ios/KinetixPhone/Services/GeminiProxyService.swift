import Foundation

/// Gemini must not be called with an API key from the app bundle. A server-side proxy is required (Lane A).
enum GeminiProxyServiceError: LocalizedError {
    case needsServerProxyFromLaneA

    var errorDescription: String? {
        switch self {
        case .needsServerProxyFromLaneA:
            return "needs server proxy from Lane A"
        }
    }
}

enum GeminiProxyService {
    static func unavailableReason() -> String {
        GeminiProxyServiceError.needsServerProxyFromLaneA.localizedDescription
    }

    /// Reserved for future streaming chat via `POST /api/...` once Lane A ships a proxy.
    static func performChatPlaceholder() throws -> Never {
        throw GeminiProxyServiceError.needsServerProxyFromLaneA
    }
}
