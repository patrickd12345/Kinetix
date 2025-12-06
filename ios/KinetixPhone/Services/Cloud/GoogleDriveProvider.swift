import Foundation
import AuthenticationServices
import UIKit

/**
 * Google Drive cloud storage provider for iOS
 * Implements OAuth 2.0 and Google Drive API v3
 */
public class GoogleDriveProvider: NSObject {
    private let clientId: String
    private let clientSecret: String
    private let redirectURI: String
    private let scope = "https://www.googleapis.com/auth/drive.file"
    private let apiBase = "https://www.googleapis.com/drive/v3"
    private let uploadBase = "https://www.googleapis.com/upload/drive/v3"
    
    private var authSession: ASWebAuthenticationSession?
    private var authContinuation: CheckedContinuation<CloudTokens, Error>?
    
    init(clientId: String, clientSecret: String, redirectURI: String) {
        self.clientId = clientId
        self.clientSecret = clientSecret
        self.redirectURI = redirectURI
        super.init()
    }
    
    /**
     * Get OAuth authorization URL
     */
    func getAuthorizationURL() -> URL {
        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        var queryItems = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: scope),
            URLQueryItem(name: "access_type", value: "offline"),
            URLQueryItem(name: "prompt", value: "consent")
        ]
        
        // Always include redirect_uri - required for OAuth flow
        // For ASWebAuthenticationSession, we use http://localhost (Google requirement)
        // but ASWebAuthenticationSession intercepts via callbackURLScheme
        queryItems.append(URLQueryItem(name: "redirect_uri", value: redirectURI))
        
        components.queryItems = queryItems
        return components.url!
    }
    
    /**
     * Authenticate with Google Drive using ASWebAuthenticationSession
     * Automatically opens Google OAuth dialog - user just needs to sign in
     */
    func authenticate(presentingViewController: UIViewController) async throws -> CloudTokens {
        // Open OAuth dialog - validation will happen when exchanging the code
        // This allows the dialog to open even with placeholder credentials
        return try await withCheckedThrowingContinuation { continuation in
            self.authContinuation = continuation
            
            let authURL = getAuthorizationURL()
            
            // This automatically opens Google's OAuth dialog
            // Calculate the callback scheme from the redirectURI
            // Format: com.googleusercontent.apps.CLIENT_ID:/oauth2redirect/google -> com.googleusercontent.apps.CLIENT_ID
            let scheme = redirectURI.components(separatedBy: ":").first ?? "com.kinetix.phone"
            
            self.authSession = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: scheme,
                completionHandler: { [weak self] callbackURL, error in
                    guard let self = self else { return }
                    
                    if let error = error {
                        continuation.resume(throwing: CloudStorageError.authenticationFailed(error.localizedDescription))
                        return
                    }
                    
                    guard let callbackURL = callbackURL,
                          let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                          let code = components.queryItems?.first(where: { $0.name == "code" })?.value else {
                        continuation.resume(throwing: CloudStorageError.authenticationFailed("No authorization code received"))
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
     * Exchange authorization code for tokens
     */
    private func exchangeCodeForToken(code: String) async throws -> CloudTokens {
        // Validate credentials at token exchange time (after OAuth dialog)
        // Note: For iOS clients, clientSecret can be empty (Google doesn't provide it)
        guard !clientId.isEmpty,
              clientId != "YOUR_GOOGLE_CLIENT_ID" else {
            throw CloudStorageError.authenticationFailed("Google OAuth credentials not configured. Please add GOOGLE_CLIENT_ID to Info.plist")
        }
        
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        
        var components = URLComponents()
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "code", value: code),
            URLQueryItem(name: "grant_type", value: "authorization_code")
        ]
        
        // Always include redirect_uri in token exchange - must match authorization request
        queryItems.append(URLQueryItem(name: "redirect_uri", value: redirectURI))
        
        // Only include client_secret if it's provided (for Web clients)
        // iOS clients don't have a client secret
        if !clientSecret.isEmpty && clientSecret != "YOUR_GOOGLE_CLIENT_SECRET" {
            queryItems.append(URLQueryItem(name: "client_secret", value: clientSecret))
        }
        
        components.queryItems = queryItems
        request.httpBody = components.query?.data(using: .utf8)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw CloudStorageError.authenticationFailed("Token exchange failed: Invalid response")
        }
        
        guard httpResponse.statusCode == 200 else {
            let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown error"
            if errorMsg.contains("invalid_client") || errorMsg.contains("client_id") {
                throw CloudStorageError.authenticationFailed("Google OAuth credentials not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to Info.plist")
            }
            throw CloudStorageError.authenticationFailed("Token exchange failed: \(errorMsg)")
        }
        
        let tokenResponse = try JSONDecoder().decode(TokenResponse.self, from: data)
        
        return CloudTokens(
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token ?? "",
            expiresAt: Date().addingTimeInterval(TimeInterval(tokenResponse.expires_in)),
            tokenType: tokenResponse.token_type ?? "Bearer"
        )
    }
    
    /**
     * Refresh access token
     */
    func refreshAccessToken(refreshToken: String) async throws -> (accessToken: String, expiresIn: TimeInterval) {
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        
        var components = URLComponents()
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "refresh_token", value: refreshToken),
            URLQueryItem(name: "grant_type", value: "refresh_token")
        ]
        
        // Only include client_secret if it's provided (for Web clients)
        // iOS clients don't have a client secret
        if !clientSecret.isEmpty && clientSecret != "YOUR_GOOGLE_CLIENT_SECRET" {
            queryItems.append(URLQueryItem(name: "client_secret", value: clientSecret))
        }
        
        components.queryItems = queryItems
        request.httpBody = components.query?.data(using: .utf8)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw CloudStorageError.authenticationFailed("Token refresh failed")
        }
        
        let tokenResponse = try JSONDecoder().decode(TokenResponse.self, from: data)
        
        return (
            accessToken: tokenResponse.access_token,
            expiresIn: TimeInterval(tokenResponse.expires_in)
        )
    }
    
    // MARK: - Error Handling Helper
    private func parseGoogleError(data: Data, statusCode: Int) -> String {
        if let errorResponse = try? JSONDecoder().decode(GoogleErrorResponse.self, from: data) {
            return errorResponse.error.message
        }
        return String(data: data, encoding: .utf8) ?? "Unknown error \(statusCode)"
    }

    /**
     * Find or create Kinetix folder
     */
    func ensureFolderExists(accessToken: String) async throws -> String {
        let folderName = "Kinetix"
        
        // Search for existing folder
        var searchURL = URLComponents(string: "\(apiBase)/files")!
        searchURL.queryItems = [
            URLQueryItem(name: "q", value: "name='\(folderName)' and mimeType='application/vnd.google-apps.folder' and trashed=false")
        ]
        
        var request = URLRequest(url: searchURL.url!)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode != 200 {
            let errorMessage = parseGoogleError(data: data, statusCode: httpResponse.statusCode)
            print("❌ Drive API Error: \(errorMessage)")
            throw CloudStorageError.networkError("Drive API: \(errorMessage)")
        }
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw CloudStorageError.networkError("Failed to search for folder")
        }
        
        let searchResult = try JSONDecoder().decode(FileListResponse.self, from: data)
        
        if let existingFolder = searchResult.files?.first {
            return existingFolder.id
        }
        
        // Create folder if it doesn't exist
        var createRequest = URLRequest(url: URL(string: "\(apiBase)/files")!)
        createRequest.httpMethod = "POST"
        createRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        createRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let folderMetadata = [
            "name": folderName,
            "mimeType": "application/vnd.google-apps.folder"
        ]
        createRequest.httpBody = try JSONSerialization.data(withJSONObject: folderMetadata)
        
        let (createData, createResponse) = try await URLSession.shared.data(for: createRequest)
        
        if let createHttpResponse = createResponse as? HTTPURLResponse, createHttpResponse.statusCode != 200 {
            let errorMessage = parseGoogleError(data: createData, statusCode: createHttpResponse.statusCode)
            throw CloudStorageError.networkError("Create Folder Error: \(errorMessage)")
        }
        
        let folder = try JSONDecoder().decode(FileResponse.self, from: createData)
        return folder.id
    }
    
    /**
     * Upload file to Google Drive
     */
    func uploadFile(filename: String, content: Data, accessToken: String) async throws {
        let folderId = try await ensureFolderExists(accessToken: accessToken)
        
        // Check if file exists
        var searchURL = URLComponents(string: "\(apiBase)/files")!
        searchURL.queryItems = [
            URLQueryItem(name: "q", value: "name='\(filename)' and '\(folderId)' in parents and trashed=false")
        ]
        
        var searchRequest = URLRequest(url: searchURL.url!)
        searchRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        
        let (searchData, searchResponse) = try await URLSession.shared.data(for: searchRequest)
        
        if let searchHttpResponse = searchResponse as? HTTPURLResponse, searchHttpResponse.statusCode != 200 {
            let errorMessage = parseGoogleError(data: searchData, statusCode: searchHttpResponse.statusCode)
            throw CloudStorageError.networkError("Search failed: \(errorMessage)")
        }
        
        guard let searchHttpResponse = searchResponse as? HTTPURLResponse,
              searchHttpResponse.statusCode == 200 else {
            throw CloudStorageError.networkError("Failed to search for file")
        }
        
        let searchResult = try JSONDecoder().decode(FileListResponse.self, from: searchData)
        let existingFile = searchResult.files?.first
        
        // Determine content type based on filename
        let contentType: String
        if filename.hasSuffix(".json") {
            contentType = "application/json"
        } else {
            contentType = "application/octet-stream"
        }
        
        // Upload or update file using multipart upload
        let boundary = UUID().uuidString
        let uploadURL: URL
        if let fileId = existingFile?.id {
            // Update existing file
            var urlComponents = URLComponents(string: "\(uploadBase)/files/\(fileId)")!
            urlComponents.queryItems = [URLQueryItem(name: "uploadType", value: "multipart")]
            uploadURL = urlComponents.url!
        } else {
            // Create new file
            var urlComponents = URLComponents(string: "\(uploadBase)/files")!
            urlComponents.queryItems = [URLQueryItem(name: "uploadType", value: "multipart")]
            uploadURL = urlComponents.url!
        }
        
        var uploadRequest = URLRequest(url: uploadURL)
        uploadRequest.httpMethod = existingFile != nil ? "PATCH" : "POST"
        uploadRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        uploadRequest.setValue("multipart/related; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        var body = Data()
        
        // Metadata part
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Type: application/json; charset=UTF-8\r\n\r\n".data(using: .utf8)!)
        
        var metadata: [String: Any] = ["name": filename]
        if existingFile == nil {
            // Only set parents for new files
            metadata["parents"] = [folderId]
        }
        body.append(try JSONSerialization.data(withJSONObject: metadata))
        body.append("\r\n".data(using: .utf8)!)
        
        // File content part
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(contentType)\r\n\r\n".data(using: .utf8)!)
        body.append(content)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        
        uploadRequest.httpBody = body
        
        let (uploadData, uploadResponse) = try await URLSession.shared.data(for: uploadRequest)
        
        if let uploadHttpResponse = uploadResponse as? HTTPURLResponse, !(200...299).contains(uploadHttpResponse.statusCode) {
            let errorMessage = parseGoogleError(data: uploadData, statusCode: uploadHttpResponse.statusCode)
            print("❌ Upload Error: \(errorMessage)")
            throw CloudStorageError.networkError("Upload failed: \(errorMessage)")
        }
        
        guard let uploadHttpResponse = uploadResponse as? HTTPURLResponse,
              (200...299).contains(uploadHttpResponse.statusCode) else {
            throw CloudStorageError.networkError("Upload failed")
        }
    }
    
    /**
     * Download file from Google Drive
     */
    func downloadFile(filename: String, accessToken: String) async throws -> Data {
        let folderId = try await ensureFolderExists(accessToken: accessToken)
        
        // Find file
        var searchURL = URLComponents(string: "\(apiBase)/files")!
        searchURL.queryItems = [
            URLQueryItem(name: "q", value: "name='\(filename)' and '\(folderId)' in parents and trashed=false")
        ]
        
        var searchRequest = URLRequest(url: searchURL.url!)
        searchRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        
        let (searchData, searchResponse) = try await URLSession.shared.data(for: searchRequest)
        
        guard let searchHttpResponse = searchResponse as? HTTPURLResponse,
              searchHttpResponse.statusCode == 200 else {
            throw CloudStorageError.networkError("Failed to search for file")
        }
        
        let searchResult = try JSONDecoder().decode(FileListResponse.self, from: searchData)
        
        guard let file = searchResult.files?.first else {
            throw CloudStorageError.fileNotFound
        }
        
        // Download file content
        var downloadRequest = URLRequest(url: URL(string: "\(apiBase)/files/\(file.id)?alt=media")!)
        downloadRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        
        let (fileData, downloadResponse) = try await URLSession.shared.data(for: downloadRequest)
        
        guard let downloadHttpResponse = downloadResponse as? HTTPURLResponse,
              downloadHttpResponse.statusCode == 200 else {
            throw CloudStorageError.networkError("Failed to download file")
        }
        
        return fileData
    }
}

// MARK: - ASWebAuthenticationPresentationContextProviding
extension GoogleDriveProvider: ASWebAuthenticationPresentationContextProviding {
    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? UIWindow()
    }
}

// MARK: - Response Models
private struct TokenResponse: Codable {
    let access_token: String
    let refresh_token: String?
    let expires_in: Int
    let token_type: String?
}

private struct FileListResponse: Codable {
    let files: [FileResponse]?
}

private struct FileResponse: Codable {
    let id: String
    let name: String?
}

private struct GoogleErrorResponse: Codable {
    let error: GoogleError
}

private struct GoogleError: Codable {
    let code: Int
    let message: String
}

