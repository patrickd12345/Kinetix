import { CloudStorageProvider } from './cloudStorageProvider.js';

/**
 * Google Drive cloud storage provider
 * Implements OAuth 2.0 and Google Drive API v3
 */
export class GoogleDriveProvider extends CloudStorageProvider {
  constructor() {
    super('google');
    this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    this.clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = `${window.location.origin}/oauth/google/callback`;
    this.scope = 'https://www.googleapis.com/auth/drive.file';
    this.apiBase = 'https://www.googleapis.com/drive/v3';
    this.uploadBase = 'https://www.googleapis.com/upload/drive/v3';
  }

  /**
   * Get OAuth authorization URL
   */
  async getAuthorizationUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scope,
      access_type: 'offline',
      prompt: 'consent', // Force refresh token
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForToken(code) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type || 'Bearer',
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type || 'Bearer',
    };
  }

  /**
   * Find or create Kinetix folder
   */
  async ensureFolderExists(folderPath, accessToken) {
    // Google Drive uses folder IDs, not paths
    // We'll search for existing folder or create it
    const folderName = 'Kinetix';
    
    // Search for existing folder
    const searchResponse = await fetch(
      `${this.apiBase}/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error('Failed to search for folder');
    }

    const searchData = await searchResponse.json();
    
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id; // Return existing folder ID
    }

    // Create folder if it doesn't exist
    const createResponse = await fetch(`${this.apiBase}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createResponse.ok) {
      throw new Error('Failed to create folder');
    }

    const folderData = await createResponse.json();
    return folderData.id;
  }

  /**
   * Upload file to Google Drive
   */
  async uploadFile(path, content, accessToken) {
    // Get or create Kinetix folder
    const folderId = await this.ensureFolderExists('Kinetix', accessToken);
    
    // Extract filename from path (e.g., "runs/run_123.json" -> "run_123.json")
    const fileName = path.split('/').pop();
    
    // Check if file exists
    const searchResponse = await fetch(
      `${this.apiBase}/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const searchData = await searchResponse.json();
    const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

    // Upload or update file
    const url = existingFile
      ? `${this.uploadBase}/files/${existingFile.id}?uploadType=multipart`
      : `${this.uploadBase}/files?uploadType=multipart`;

    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', new Blob([content], { type: 'application/json' }));

    const response = await fetch(url, {
      method: existingFile ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Upload failed: ${error.error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Download file from Google Drive
   */
  async downloadFile(path, accessToken) {
    const folderId = await this.ensureFolderExists('Kinetix', accessToken);
    const fileName = path.split('/').pop();

    // Find file
    const searchResponse = await fetch(
      `${this.apiBase}/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error('Failed to search for file');
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.files || searchData.files.length === 0) {
      throw new Error('File not found');
    }

    const fileId = searchData.files[0].id;

    // Download file content
    const downloadResponse = await fetch(`${this.apiBase}/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!downloadResponse.ok) {
      throw new Error('Failed to download file');
    }

    return await downloadResponse.text();
  }

  /**
   * List files in folder
   */
  async listFiles(folderPath, accessToken) {
    const folderId = await this.ensureFolderExists('Kinetix', accessToken);
    const subfolderName = folderPath.split('/').filter(Boolean).pop() || 'Kinetix';

    // If listing root Kinetix folder, get all files
    if (subfolderName === 'Kinetix') {
      const response = await fetch(
        `${this.apiBase}/files?q='${folderId}' in parents and trashed=false`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to list files');
      }

      const data = await response.json();
      return data.files ? data.files.map(f => f.name) : [];
    }

    // For subfolders, find the subfolder first
    const subfolderResponse = await fetch(
      `${this.apiBase}/files?q=name='${subfolderName}' and '${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const subfolderData = await subfolderResponse.json();
    
    if (!subfolderData.files || subfolderData.files.length === 0) {
      return [];
    }

    const subfolderId = subfolderData.files[0].id;

    const response = await fetch(
      `${this.apiBase}/files?q='${subfolderId}' in parents and trashed=false`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to list files');
    }

    const data = await response.json();
    return data.files ? data.files.map(f => f.name) : [];
  }

  /**
   * Delete file from Google Drive
   */
  async deleteFile(path, accessToken) {
    const folderId = await this.ensureFolderExists('Kinetix', accessToken);
    const fileName = path.split('/').pop();

    // Find file
    const searchResponse = await fetch(
      `${this.apiBase}/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error('Failed to search for file');
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.files || searchData.files.length === 0) {
      return; // File doesn't exist, nothing to delete
    }

    const fileId = searchData.files[0].id;

    // Delete file
    const deleteResponse = await fetch(`${this.apiBase}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      throw new Error('Failed to delete file');
    }
  }
}

