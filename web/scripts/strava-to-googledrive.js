/**
 * Strava to Google Drive Export Script
 * Fetches last 90 days of Strava runs and uploads to Google Drive
 * 
 * Usage:
 * 1. Set Strava API credentials:
 *    export STRAVA_CLIENT_ID=your_client_id
 *    export STRAVA_CLIENT_SECRET=your_client_secret
 *    export STRAVA_ACCESS_TOKEN=your_access_token (or use OAuth flow)
 * 
 * 2. Set Google OAuth credentials:
 *    export GOOGLE_CLIENT_ID=your_google_client_id
 *    export GOOGLE_CLIENT_SECRET=your_google_client_secret
 *    export GOOGLE_REFRESH_TOKEN=your_refresh_token (optional, will prompt for OAuth if not set)
 * 
 * 3. Run: node scripts/strava-to-googledrive.js
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Strava API configuration
const STRAVA_API_URL = 'https://www.strava.com/api/v3';
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const STRAVA_ACCESS_TOKEN = process.env.STRAVA_ACCESS_TOKEN;
const STRAVA_REFRESH_TOKEN = process.env.STRAVA_REFRESH_TOKEN;

// Google Drive API configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const GOOGLE_ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN;

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const GOOGLE_OAUTH_TOKEN = 'https://oauth2.googleapis.com/token';

/**
 * Get Strava access token
 */
async function getStravaAccessToken() {
  if (STRAVA_ACCESS_TOKEN) {
    const valid = await verifyStravaToken(STRAVA_ACCESS_TOKEN);
    if (valid) {
      return STRAVA_ACCESS_TOKEN;
    }
  }

  if (STRAVA_REFRESH_TOKEN && STRAVA_CLIENT_ID && STRAVA_CLIENT_SECRET) {
    return await refreshStravaToken();
  }

  console.log('\n🔐 Strava Authentication Required');
  console.log('=====================================');
  console.log('\n1. Go to: https://www.strava.com/oauth/authorize');
  console.log(`   Client ID: ${STRAVA_CLIENT_ID || 'YOUR_CLIENT_ID'}`);
  console.log('   Response Type: code');
  console.log('   Scope: activity:read_all');
  console.log('   Redirect URI: http://localhost:8080');
  console.log('\n2. After authorization, extract the code from the redirect URL');
  console.log('3. Run: STRAVA_CODE=your_code node scripts/strava-to-googledrive.js\n');
  
  const code = process.env.STRAVA_CODE;
  if (code) {
    return await exchangeStravaCodeForToken(code);
  }

  throw new Error('No valid Strava access token. See instructions above.');
}

async function verifyStravaToken(token) {
  try {
    const response = await fetch(`${STRAVA_API_URL}/athlete`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function refreshStravaToken() {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: STRAVA_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Strava token');
  }

  const data = await response.json();
  console.log('✅ Strava token refreshed');
  return data.access_token;
}

async function exchangeStravaCodeForToken(code) {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Strava token exchange failed: ${error}`);
  }

  const data = await response.json();
  console.log('✅ Strava token obtained');
  console.log(`\n💡 Save for future use:\n`);
  console.log(`   export STRAVA_ACCESS_TOKEN="${data.access_token}"`);
  console.log(`   export STRAVA_REFRESH_TOKEN="${data.refresh_token}"\n`);
  
  return data.access_token;
}

/**
 * Fetch last 90 days of activities from Strava
 */
async function fetchLast90DaysActivities(accessToken) {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
  const afterTimestamp = Math.floor(ninetyDaysAgo.getTime() / 1000);

  let page = 1;
  let allActivities = [];
  let hasMore = true;

  console.log('\n📥 Fetching last 90 days of activities from Strava...');
  console.log(`   Date range: ${ninetyDaysAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`);

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
      // Check if we've gone past 90 days
      const oldestActivity = activities[activities.length - 1];
      const oldestDate = new Date(oldestActivity.start_date);
      if (oldestDate < ninetyDaysAgo) {
        // Filter to only include activities within 90 days
        const filtered = activities.filter(a => new Date(a.start_date) >= ninetyDaysAgo);
        allActivities = allActivities.concat(filtered);
        hasMore = false;
      } else {
        allActivities = allActivities.concat(activities);
        console.log(`   Fetched page ${page}: ${activities.length} activities (${allActivities.length} total)`);
        page++;
        
        // Rate limiting: wait 1 second between pages
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  }

  console.log(`\n✅ Fetched ${allActivities.length} total activities from last 90 days`);
  return allActivities;
}

/**
 * Convert Strava activities to runs
 */
function convertToRuns(activities) {
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

    // Calculate NPI
    const distanceKm = activity.distance / 1000; // meters to km
    const paceSecondsPerKm = (activity.moving_time / distanceKm); // seconds per km
    const speedKmH = 3600 / paceSecondsPerKm; // km/h
    const factor = Math.pow(distanceKm, 0.06);
    const npi = speedKmH * factor * 10.0;

    const run = {
      id: `strava_${activity.id}`,
      date: new Date(activity.start_date).toISOString(),
      source: 'strava',
      distance: activity.distance, // meters
      duration: activity.moving_time, // seconds
      avgPace: paceSecondsPerKm,
      avgNPI: npi,
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
// Exported for testability
export { convertToRuns };

/**
 * Get Google Drive access token
 */
async function getGoogleAccessToken() {
  if (GOOGLE_ACCESS_TOKEN) {
    const valid = await verifyGoogleToken(GOOGLE_ACCESS_TOKEN);
    if (valid) {
      return GOOGLE_ACCESS_TOKEN;
    }
  }

  if (GOOGLE_REFRESH_TOKEN && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    return await refreshGoogleToken();
  }

  // Need OAuth flow
  console.log('\n🔐 Google Drive Authentication Required');
  console.log('==========================================');
  console.log('\n1. Go to: https://accounts.google.com/o/oauth2/v2/auth');
  console.log(`   Client ID: ${GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID'}`);
  console.log('   Response Type: code');
  console.log('   Scope: https://www.googleapis.com/auth/drive.file');
  console.log('   Access Type: offline');
  console.log('   Redirect URI: http://localhost:8080/oauth/google/callback');
  console.log('\n2. After authorization, extract the code from the redirect URL');
  console.log('3. Run: GOOGLE_CODE=your_code node scripts/strava-to-googledrive.js\n');
  
  const code = process.env.GOOGLE_CODE;
  if (code) {
    const tokens = await exchangeGoogleCodeForToken(code);
    console.log(`\n💡 Save for future use:\n`);
    console.log(`   export GOOGLE_ACCESS_TOKEN="${tokens.accessToken}"`);
    console.log(`   export GOOGLE_REFRESH_TOKEN="${tokens.refreshToken}"\n`);
    return tokens.accessToken;
  }

  throw new Error('No valid Google access token. See instructions above.');
}

async function verifyGoogleToken(token) {
  try {
    const response = await fetch(`${GOOGLE_DRIVE_API}/about?fields=user`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function refreshGoogleToken() {
  const response = await fetch(GOOGLE_OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Google token');
  }

  const data = await response.json();
  console.log('✅ Google token refreshed');
  return data.access_token;
}

async function exchangeGoogleCodeForToken(code) {
  const redirectUri = 'http://localhost:8080/oauth/google/callback';
  
  const response = await fetch(GOOGLE_OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google token exchange failed: ${error}`);
  }

  const data = await response.json();
  console.log('✅ Google token obtained');
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

/**
 * Find or create Kinetix folder in Google Drive
 */
async function ensureKinetixFolder(accessToken) {
  const folderName = 'Kinetix';
  
  // Search for existing folder
  const searchUrl = new URL(`${GOOGLE_DRIVE_API}/files`);
  searchUrl.searchParams.set('q', `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  
  const searchResponse = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!searchResponse.ok) {
    throw new Error(`Failed to search for folder: ${searchResponse.statusText}`);
  }

  const searchResult = await searchResponse.json();
  
  if (searchResult.files && searchResult.files.length > 0) {
    console.log(`✅ Found existing "Kinetix" folder`);
    return searchResult.files[0].id;
  }

  // Create folder
  const createResponse = await fetch(`${GOOGLE_DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create folder: ${error}`);
  }

  const folder = await createResponse.json();
  console.log(`✅ Created "Kinetix" folder`);
  return folder.id;
}

/**
 * Upload JSON file to Google Drive
 */
async function uploadToGoogleDrive(accessToken, filename, content, folderId) {
  // Check if file exists
  const searchUrl = new URL(`${GOOGLE_DRIVE_API}/files`);
  searchUrl.searchParams.set('q', `name='${filename}' and '${folderId}' in parents and trashed=false`);
  
  const searchResponse = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!searchResponse.ok) {
    throw new Error(`Failed to search for file: ${searchResponse.statusText}`);
  }

  const searchResult = await searchResponse.json();
  const existingFile = searchResult.files && searchResult.files.length > 0 ? searchResult.files[0] : null;

  // Prepare multipart upload
  const boundary = `----WebKitFormBoundary${Date.now()}`;
  const contentType = 'application/json';
  
  let body = '';
  
  // Metadata part
  body += `--${boundary}\r\n`;
  body += `Content-Type: application/json; charset=UTF-8\r\n\r\n`;
  body += JSON.stringify({
    name: filename,
    ...(existingFile ? {} : { parents: [folderId] }),
  });
  body += `\r\n--${boundary}\r\n`;
  
  // File content part
  body += `Content-Type: ${contentType}\r\n\r\n`;
  body += content;
  body += `\r\n--${boundary}--\r\n`;

  const uploadUrl = existingFile
    ? `${GOOGLE_DRIVE_UPLOAD}/files/${existingFile.id}?uploadType=multipart`
    : `${GOOGLE_DRIVE_UPLOAD}/files?uploadType=multipart`;

  const uploadResponse = await fetch(uploadUrl, {
    method: existingFile ? 'PATCH' : 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: body,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`Failed to upload file: ${error}`);
  }

  const result = await uploadResponse.json();
  return result;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('\n🏃 Strava to Google Drive Export');
    console.log('==================================\n');

    // Check Strava credentials
    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
      console.error('❌ Missing Strava API credentials');
      console.error('\n1. Go to: https://www.strava.com/settings/api');
      console.error('2. Create an application');
      console.error('3. Set environment variables:');
      console.error('   export STRAVA_CLIENT_ID=your_client_id');
      console.error('   export STRAVA_CLIENT_SECRET=your_client_secret');
      process.exit(1);
    }

    // Check Google credentials
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error('❌ Missing Google OAuth credentials');
      console.error('\n1. Go to: https://console.cloud.google.com/');
      console.error('2. Create OAuth 2.0 credentials (Web application type)');
      console.error('3. Set environment variables:');
      console.error('   export GOOGLE_CLIENT_ID=your_client_id');
      console.error('   export GOOGLE_CLIENT_SECRET=your_client_secret');
      process.exit(1);
    }

    // Get Strava access token
    console.log('🔐 Authenticating with Strava...');
    const stravaToken = await getStravaAccessToken();

    // Fetch last 90 days of activities
    const activities = await fetchLast90DaysActivities(stravaToken);

    // Convert to runs
    console.log('\n🔄 Converting activities to runs...');
    const runs = convertToRuns(activities);
    console.log(`✅ Converted ${runs.length} runs`);

    if (runs.length === 0) {
      console.log('\n⚠️  No runs found in the last 90 days');
      process.exit(0);
    }

    // Prepare JSON data
    const jsonData = JSON.stringify(runs, null, 2);
    const filename = `strava-runs-last-90-days-${new Date().toISOString().split('T')[0]}.json`;

    // Save locally as backup
    const localPath = join(__dirname, '../', filename);
    writeFileSync(localPath, jsonData);
    console.log(`\n💾 Saved locally as backup: ${localPath}`);

    // Get Google Drive access token
    console.log('\n🔐 Authenticating with Google Drive...');
    const googleToken = await getGoogleAccessToken();

    // Ensure Kinetix folder exists
    console.log('\n📁 Setting up Google Drive folder...');
    const folderId = await ensureKinetixFolder(googleToken);

    // Upload to Google Drive
    console.log(`\n☁️  Uploading to Google Drive...`);
    console.log(`   Filename: ${filename}`);
    console.log(`   Size: ${(jsonData.length / 1024).toFixed(2)} KB`);
    console.log(`   Runs: ${runs.length}`);
    
    const uploadResult = await uploadToGoogleDrive(googleToken, filename, jsonData, folderId);
    
    console.log(`\n✅ Successfully uploaded to Google Drive!`);
    console.log(`   File ID: ${uploadResult.id}`);
    console.log(`   View at: https://drive.google.com/file/d/${uploadResult.id}/view`);
    console.log(`\n✨ Export complete! ${runs.length} runs from last 90 days are now in Google Drive.\n`);

  } catch (error) {
    console.error('\n❌ Export failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Exported for testing
export {
  getStravaAccessToken,
  refreshStravaToken,
  exchangeStravaCodeForToken,
  getGoogleAccessToken,
  refreshGoogleToken,
  exchangeGoogleCodeForToken,
  ensureKinetixFolder,
  uploadToGoogleDrive,
};
