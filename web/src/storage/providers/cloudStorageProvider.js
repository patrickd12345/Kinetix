/**
 * Abstract base class for cloud storage providers
 * Defines the interface that all cloud storage providers must implement
 */
/* eslint-disable no-unused-vars */
export class CloudStorageProvider {
  constructor(providerName) {
    this.providerName = providerName;
  }

  /**
   * Initialize OAuth flow and get authorization URL
   * @returns {Promise<string>} Authorization URL
   */
  async getAuthorizationUrl() {
    throw new Error('getAuthorizationUrl must be implemented by provider');
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Promise<{accessToken: string, refreshToken: string, expiresIn: number}>}
   */
  async exchangeCodeForToken(code) {
    throw new Error('exchangeCodeForToken must be implemented by provider');
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<{accessToken: string, expiresIn: number}>}
   */
  async refreshAccessToken(refreshToken) {
    throw new Error('refreshAccessToken must be implemented by provider');
  }

  /**
   * Upload a file to cloud storage
   * @param {string} path - File path in cloud storage
   * @param {string} content - File content (string)
   * @param {string} accessToken - Access token
   * @returns {Promise<void>}
   */
  async uploadFile(path, content, accessToken) {
    throw new Error('uploadFile must be implemented by provider');
  }

  /**
   * Download a file from cloud storage
   * @param {string} path - File path in cloud storage
   * @param {string} accessToken - Access token
   * @returns {Promise<string>} File content
   */
  async downloadFile(path, accessToken) {
    throw new Error('downloadFile must be implemented by provider');
  }

  /**
   * List files in a folder
   * @param {string} folderPath - Folder path
   * @param {string} accessToken - Access token
   * @returns {Promise<string[]>} Array of file names
   */
  async listFiles(folderPath, accessToken) {
    throw new Error('listFiles must be implemented by provider');
  }

  /**
   * Check if a folder exists, create if it doesn't
   * @param {string} folderPath - Folder path
   * @param {string} accessToken - Access token
   * @returns {Promise<void>}
   */
  async ensureFolderExists(folderPath, accessToken) {
    throw new Error('ensureFolderExists must be implemented by provider');
  }

  /**
   * Delete a file from cloud storage
   * @param {string} path - File path
   * @param {string} accessToken - Access token
   * @returns {Promise<void>}
   */
  async deleteFile(path, accessToken) {
    throw new Error('deleteFile must be implemented by provider');
  }
}
