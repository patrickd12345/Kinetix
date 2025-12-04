import Foundation
import AuthenticationServices
import UIKit

/**
 * Google Drive cloud storage provider for iOS
 * Implements OAuth 2.0 and Google Drive API v3
 */
class GoogleDriveProvider: NSObject {
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
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: scope),
            URLQueryItem(name: "access_type", value: "offline"),
            URLQueryItem(name: "prompt", value: "consent")
        ]
        return components.url!
    }
    
    /**
     * Authenticate with Google Drive using ASWebAuthenticationSession
     * Automatically opens Google OAuth dialog - user just needs to sign in
     */
    func authenticate(presentingViewController: UIViewController) async throws -> CloudTokens {
        // Validate credentials
        guard !clientId.isEmpty, clientId != "YOUR_GOOGLE_CLIENT_ID" else {
            throw CloudStorageError.authenticationFailed("Google OAuth credentials not configured")
        }
        
        return try await withCheckedThrowingContinuation { continuation in
            self.authContinuation = continuation
            
            let authURL = getAuthorizationURL()
            
            // This automatically opens Google's OAuth dialog
            self.authSession = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: URL(string: redirectURI)?.scheme,
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
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        
        var components = URLComponents()
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "client_secret", value: clientSecret),
            URLQueryItem(name: "code", value: code),
            URLQueryItem(name: "grant_type", value: "authorization_code"),
            URLQueryItem(name: "redirect_uri", value: redirectURI)
        ]
        request.httpBody = components.query?.data(using: .utf8)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw CloudStorageError.authenticationFailed("Token exchange failed")
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
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "client_secret", value: clientSecret),
            URLQueryItem(name: "refresh_token", value: refreshToken),
            URLQueryItem(name: "grant_type", value: "refresh_token")
        ]
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
        
        guard let createHttpResponse = createResponse as? HTTPURLResponse,
              createHttpResponse.statusCode == 200 else {
            throw CloudStorageError.networkError("Failed to create folder")
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
        
        guard let searchHttpResponse = searchResponse as? HTTPURLResponse,
              searchHttpResponse.statusCode == 200 else {
            throw CloudStorageError.networkError("Failed to search for file")
        }
        
        let searchResult = try JSONDecoder().decode(FileListResponse.self, from: searchData)
        let existingFile = searchResult.files?.first
        
        // Upload or update file using multipart upload
        let boundary = UUID().uuidString
        var uploadRequest = URLRequest(url: URL(string: "\(uploadBase)/files\(existingFile != nil ? "/\(existingFile!.id)" : "")?uploadType=multipart")!)
        uploadRequest.httpMethod = existingFile != nil ? "PATCH" : "POST"
        uploadRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        uploadRequest.setValue("multipart/related; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        var body = Data()
        
        // Metadata part
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Type: application/json\r\n\r\n".data(using: .utf8)!)
        let metadata = [
            "name": filename,
            "parents": [folderId]
        ]
        body.append(try JSONSerialization.data(withJSONObject: metadata))
        body.append("\r\n".data(using: .utf8)!)
        
        // File content part
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Type: application/json\r\n\r\n".data(using: .utf8)!)
        body.append(content)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        
        uploadRequest.httpBody = body
        
        let (_, uploadResponse) = try await URLSession.shared.data(for: uploadRequest)
        
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
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
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

