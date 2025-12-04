/**
 * Secure token storage for cloud storage providers
 * Stores encrypted tokens in IndexedDB
 */

const DB_NAME = 'kinetix_cloud_db';
const DB_VERSION = 1;
const TOKENS_STORE = 'tokens';

let dbPromise = null;

/**
 * Simple encryption/decryption using Web Crypto API
 * In production, you might want more sophisticated encryption
 */
async function encrypt(text, key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  
  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  };
}

async function decrypt(encrypted, key) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(encrypted.iv) },
    cryptoKey,
    new Uint8Array(encrypted.data)
  );
  
  return decoder.decode(decrypted);
}

/**
 * Get encryption key (derived from device/user identifier)
 * In production, this should be more secure
 */
function getEncryptionKey() {
  // Use a combination of device identifier and app identifier
  // This is a simple approach - in production, use a more secure method
  const deviceId = localStorage.getItem('kinetix_device_id') || crypto.randomUUID();
  if (!localStorage.getItem('kinetix_device_id')) {
    localStorage.setItem('kinetix_device_id', deviceId);
  }
  return `kinetix_${deviceId}`;
}

function getDB() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open cloud token DB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(TOKENS_STORE)) {
        db.createObjectStore(TOKENS_STORE, { keyPath: 'provider' });
      }
    };
  });

  return dbPromise;
}

export class CloudTokenStorage {
  /**
   * Store tokens for a provider
   */
  static async storeTokens(provider, tokens) {
    try {
      const db = await getDB();
      const key = getEncryptionKey();
      
      // Encrypt tokens
      const encryptedAccess = await encrypt(tokens.accessToken, key);
      const encryptedRefresh = await encrypt(tokens.refreshToken, key);
      
      const tokenData = {
        provider,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        expiresAt: tokens.expiresAt || (Date.now() + (tokens.expiresIn * 1000)),
        tokenType: tokens.tokenType || 'Bearer',
        scope: tokens.scope || '',
        lastRefresh: Date.now(),
      };

      const tx = db.transaction([TOKENS_STORE], 'readwrite');
      const store = tx.objectStore(TOKENS_STORE);
      
      await new Promise((resolve, reject) => {
        const request = store.put(tokenData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw error;
    }
  }

  /**
   * Get tokens for a provider
   */
  static async getTokens(provider) {
    try {
      const db = await getDB();
      const tx = db.transaction([TOKENS_STORE], 'readonly');
      const store = tx.objectStore(TOKENS_STORE);
      
      const tokenData = await new Promise((resolve, reject) => {
        const request = store.get(provider);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!tokenData) {
        return null;
      }

      const key = getEncryptionKey();
      
      // Decrypt tokens
      const accessToken = await decrypt(tokenData.accessToken, key);
      const refreshToken = await decrypt(tokenData.refreshToken, key);

      return {
        accessToken,
        refreshToken,
        expiresAt: tokenData.expiresAt,
        tokenType: tokenData.tokenType,
        scope: tokenData.scope,
        lastRefresh: tokenData.lastRefresh,
      };
    } catch (error) {
      console.error('Failed to get tokens:', error);
      return null;
    }
  }

  /**
   * Update access token (after refresh)
   */
  static async updateAccessToken(provider, accessToken, expiresIn) {
    try {
      const tokens = await this.getTokens(provider);
      if (!tokens) {
        throw new Error('No tokens found to update');
      }

      await this.storeTokens(provider, {
        accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: Date.now() + (expiresIn * 1000),
        tokenType: tokens.tokenType,
        scope: tokens.scope,
      });
    } catch (error) {
      console.error('Failed to update access token:', error);
      throw error;
    }
  }

  /**
   * Check if tokens exist for a provider
   */
  static async hasTokens(provider) {
    const tokens = await this.getTokens(provider);
    return tokens !== null;
  }

  /**
   * Remove tokens for a provider
   */
  static async removeTokens(provider) {
    try {
      const db = await getDB();
      const tx = db.transaction([TOKENS_STORE], 'readwrite');
      const store = tx.objectStore(TOKENS_STORE);
      
      await new Promise((resolve, reject) => {
        const request = store.delete(provider);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to remove tokens:', error);
      throw error;
    }
  }

  /**
   * Check if token is expired or will expire soon
   */
  static async isTokenValid(provider) {
    const tokens = await this.getTokens(provider);
    if (!tokens) {
      return false;
    }

    // Consider expired if expires in less than 5 minutes
    return tokens.expiresAt > (Date.now() + 5 * 60 * 1000);
  }
}

