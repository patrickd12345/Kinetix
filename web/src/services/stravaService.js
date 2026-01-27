/**
 * Strava API Service
 * Handles authentication and data fetching from Strava
 */

const STRAVA_API_URL = 'https://www.strava.com/api/v3';

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
}

function resolveStorage(storageOverride) {
  if (storageOverride) return storageOverride;
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // ignore and fall back to memory storage
  }
  return new MemoryStorage();
}

function resolveEnv(key) {
  try {
    return import.meta.env?.[key];
  } catch {
    return undefined;
  }
}

export class StravaService {
  constructor(options = {}) {
    // App credentials - configured by developer, not user
    this.clientId = options.clientId || resolveEnv('VITE_STRAVA_CLIENT_ID') || '';
    this.clientSecret = options.clientSecret || resolveEnv('VITE_STRAVA_CLIENT_SECRET') || '';
    const defaultRedirect = typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/auth/strava`
      : 'http://localhost/auth/strava';
    this.redirectUri = options.redirectUri || defaultRedirect;
    this.storage = resolveStorage(options.storage);
    
    if (!this.clientId || !this.clientSecret) {
      console.warn('Strava credentials not configured. Please set VITE_STRAVA_CLIENT_ID and VITE_STRAVA_CLIENT_SECRET in environment variables.');
    }
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'activity:read_all',
      approval_prompt: 'force',
    });

    return `https://www.strava.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code) {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.message || error.error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      athlete: data.athlete,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token refresh failed: ${error.message || error.error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };
  }

  /**
   * Verify token is valid
   */
  async verifyToken(accessToken) {
    try {
      const response = await fetch(`${STRAVA_API_URL}/athlete`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch activities from Strava
   * @param {string} accessToken - Strava access token
   * @param {number} days - Number of days to fetch (default: 90)
   * @returns {Promise<Array>} Array of activities
   */
  async fetchActivities(accessToken, days = 90) {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    const afterTimestamp = Math.floor(cutoffDate.getTime() / 1000);

    let page = 1;
    let allActivities = [];
    let hasMore = true;

    while (hasMore) {
      const url = `${STRAVA_API_URL}/athlete/activities?page=${page}&per_page=200&after=${afterTimestamp}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch activities: ${response.status} ${response.statusText}`);
      }

      const activities = await response.json();
      
      if (activities.length === 0) {
        hasMore = false;
      } else {
        // Filter to only include activities within the date range
        const filtered = activities.filter(a => new Date(a.start_date) >= cutoffDate);
        allActivities = allActivities.concat(filtered);
        
        // If we got fewer activities than requested, we're done
        if (activities.length < 200) {
          hasMore = false;
        } else {
          page++;
          // Rate limiting: wait 1 second between pages
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    return allActivities;
  }

  /**
   * Convert Strava activities to Kinetix Run format
   */
  convertToRuns(activities) {
    const runs = [];
    
    for (const activity of activities) {
      // Only process running activities
      if (activity.type !== 'Run' && activity.sport_type !== 'Run') {
        continue;
      }

      // Skip activities without distance or duration
      if (!activity.distance || !activity.moving_time) {
        continue;
      }

      const distanceKm = activity.distance / 1000; // meters to km
      const paceSecondsPerKm = (activity.moving_time / distanceKm); // seconds per km

      const run = {
        id: `strava_${activity.id}`,
        date: new Date(activity.start_date).toISOString(),
        source: 'strava',
        distance: activity.distance, // meters
        duration: activity.moving_time, // seconds
        avgPace: paceSecondsPerKm,
        kps: 0, // computed at import time (PB-aware)
        setPb: false,
        avgHeartRate: activity.average_heartrate || 0,
        avgCadence: activity.average_cadence ? activity.average_cadence * 2 : null,
        routeData: [],
        formScore: null,
        formSessionId: null,
        stravaId: activity.id,
        stravaName: activity.name,
        stravaDescription: activity.description || null,
        elevationGain: activity.total_elevation_gain || 0,
      };

      runs.push(run);
    }

    return runs;
  }

  /**
   * Upload a run to Strava
   * @param {string} accessToken - Strava access token
   * @param {Object} run - Kinetix Run object
   * @returns {Promise<Object>} Created Strava activity
   */
  async uploadActivity(accessToken, run) {
    // Convert Kinetix run to Strava activity format
    const startDate = new Date(run.date || run.startDate || Date.now());
    
    // Build activity name
    const distanceKm = (run.distance || 0) / 1000;
    const durationHours = Math.floor((run.duration || 0) / 3600);
    const durationMinutes = Math.floor(((run.duration || 0) % 3600) / 60);
    const activityName = run.name || `Run - ${distanceKm.toFixed(2)} km`;
    
    // Build description with KPS (if available)
    const description = run.kps
      ? `KPS: ${Number(run.kps).toFixed(1)}\nDistance: ${distanceKm.toFixed(2)} km\nDuration: ${durationHours}:${durationMinutes.toString().padStart(2, '0')}`
      : `Distance: ${distanceKm.toFixed(2)} km\nDuration: ${durationHours}:${durationMinutes.toString().padStart(2, '0')}`;

    // Prepare activity data
    const activityData = {
      name: activityName,
      type: 'Run',
      start_date_local: startDate.toISOString(),
      elapsed_time: run.duration || 0,
      distance: run.distance || 0, // meters
      description: description,
    };

    // Add optional fields if available
    if (run.avgHeartRate && run.avgHeartRate > 0) {
      activityData.average_heartrate = run.avgHeartRate;
    }

    if (run.elevationGain && run.elevationGain > 0) {
      activityData.total_elevation_gain = run.elevationGain;
    }

    // If we have route data, we can upload it as a GPX file
    // For now, we'll just upload the basic activity
    // TODO: Support GPX upload for route data

    const response = await fetch(`${STRAVA_API_URL}/activities`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(activityData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to upload activity to Strava: ${error.message || error.error}`);
    }

    const activity = await response.json();
    return activity;
  }

  /**
   * Get stored Strava tokens from localStorage
   */
  getStoredTokens() {
    try {
      const stored = this.storage?.getItem('strava_tokens');
      if (!stored) return null;
      const tokens = JSON.parse(stored);
      // Check if token is expired
      if (tokens.expiresAt && tokens.expiresAt < Date.now()) {
        return null; // Token expired
      }
      return tokens;
    } catch {
      return null;
    }
  }

  /**
   * Store Strava tokens in localStorage
   */
  storeTokens(tokens) {
    try {
      this.storage?.setItem('strava_tokens', JSON.stringify(tokens));
    } catch (error) {
      console.error('Failed to store Strava tokens:', error);
    }
  }

  /**
   * Clear stored Strava tokens
   */
  clearTokens() {
    try {
      this.storage?.removeItem('strava_tokens');
    } catch (error) {
      console.error('Failed to clear Strava tokens:', error);
    }
  }

  /**
   * Get valid access token (checks stored tokens and refreshes if needed)
   */
  async getValidAccessToken() {
    let tokens = this.getStoredTokens();
    
    if (!tokens) {
      throw new Error('Not authenticated with Strava. Please connect Strava first.');
    }

    // Check if token is expired or about to expire (within 5 minutes)
    if (tokens.expiresAt && tokens.expiresAt < (Date.now() + 5 * 60 * 1000)) {
      // Refresh token
      if (tokens.refreshToken) {
        try {
          tokens = await this.refreshAccessToken(tokens.refreshToken);
          this.storeTokens(tokens);
        } catch (error) {
          this.clearTokens();
          throw new Error('Strava token expired. Please reconnect Strava.');
        }
      } else {
        this.clearTokens();
        throw new Error('Strava token expired. Please reconnect Strava.');
      }
    }

    return tokens.accessToken;
  }
}

export const stravaService = new StravaService();

