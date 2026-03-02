/**
 * Strava Import Script
 * One-shot import of Strava runs into Kinetix database
 * 
 * Usage:
 * 1. Get Strava API credentials: https://www.strava.com/settings/api
 * 2. Set environment variables:
 *    STRAVA_CLIENT_ID=your_client_id
 *    STRAVA_CLIENT_SECRET=your_client_secret
 *    STRAVA_ACCESS_TOKEN=your_access_token (or use OAuth flow)
 * 3. Run: node scripts/strava-import.js
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
const STRAVA_DAYS = Number.isFinite(Number(process.env.STRAVA_DAYS))
  ? Math.max(1, Number(process.env.STRAVA_DAYS))
  : null; // null = all time

/**
 * Get Strava access token (OAuth flow or use existing)
 */
async function getAccessToken() {
  if (STRAVA_ACCESS_TOKEN) {
    // Verify token is valid
    const valid = await verifyToken(STRAVA_ACCESS_TOKEN);
    if (valid) {
      return STRAVA_ACCESS_TOKEN;
    }
  }

  if (STRAVA_REFRESH_TOKEN && STRAVA_CLIENT_ID && STRAVA_CLIENT_SECRET) {
    // Refresh token
    return await refreshAccessToken();
  }

  // Need to get token via OAuth
  console.log('\n🔐 Strava Authentication Required');
  console.log('=====================================');
  console.log('\n1. Go to: https://www.strava.com/oauth/authorize');
  console.log(`   Client ID: ${STRAVA_CLIENT_ID || 'YOUR_CLIENT_ID'}`);
  console.log('   Response Type: code');
  console.log('   Scope: activity:read_all');
  console.log('   Redirect URI: http://localhost:8080');
  console.log('\n2. After authorization, you\'ll be redirected to:');
  console.log('   http://localhost:8080?code=YOUR_CODE');
  console.log('\n3. Extract the code and run:');
  console.log('   STRAVA_CODE=your_code node scripts/strava-import.js');
  console.log('\nOr set STRAVA_ACCESS_TOKEN directly if you have one.\n');
  
  const code = process.env.STRAVA_CODE;
  if (code) {
    return await exchangeCodeForToken(code);
  }

  throw new Error('No valid access token. See instructions above.');
}

/**
 * Verify token is valid
 */
async function verifyToken(token) {
  try {
    const response = await fetch(`${STRAVA_API_URL}/athlete`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Refresh access token
 */
async function refreshAccessToken() {
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
    throw new Error('Failed to refresh token');
  }

  const data = await response.json();
  console.log('✅ Token refreshed');
  console.log(`   New access token: ${data.access_token}`);
  console.log(`   New refresh token: ${data.refresh_token}`);
  console.log('\n💡 Save these tokens for future use:\n');
  console.log(`   export STRAVA_ACCESS_TOKEN="${data.access_token}"`);
  console.log(`   export STRAVA_REFRESH_TOKEN="${data.refresh_token}"`);
  
  return data.access_token;
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(code) {
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
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();
  console.log('✅ Token obtained');
  console.log(`   Access token: ${data.access_token}`);
  console.log(`   Refresh token: ${data.refresh_token}`);
  console.log('\n💡 Save these tokens for future use:\n');
  console.log(`   export STRAVA_ACCESS_TOKEN="${data.access_token}"`);
  console.log(`   export STRAVA_REFRESH_TOKEN="${data.refresh_token}"`);
  
  return data.access_token;
}

/**
 * Fetch all activities from Strava
 */
async function fetchActivities(accessToken, options = {}) {
  const { perPage = 200, maxPages = null, afterDays = null } = options;
  let page = 1;
  let allActivities = [];
  let hasMore = true;

  console.log('\n📥 Fetching activities from Strava...');

  const afterTimestamp = afterDays
    ? Math.floor((Date.now() - afterDays * 24 * 60 * 60 * 1000) / 1000)
    : null;

  while (hasMore && (!maxPages || page <= maxPages)) {
    const url = new URL(`${STRAVA_API_URL}/athlete/activities`);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('per_page', perPage.toString());
    if (afterTimestamp) {
      url.searchParams.set('after', afterTimestamp.toString());
    }
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
      allActivities = allActivities.concat(activities);
      console.log(`   Fetched page ${page}: ${activities.length} activities (${allActivities.length} total)`);
      page++;
      
      // Rate limiting: Strava allows 600 requests per 15 minutes
      // Be nice and wait a bit between pages
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  console.log(`\n✅ Fetched ${allActivities.length} total activities`);
  return allActivities;
}

/**
 * Filter and convert Strava activities to runs
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
    // NPI formula: speedKmH * factor * 10.0 where factor = distanceKm^0.06
    const speedKmH = 3600 / paceSecondsPerKm; // km/h
    const factor = Math.pow(distanceKm, 0.06);
    const npi = speedKmH * factor * 10.0;

    // Get detailed activity data (for heart rate, cadence, etc.)
    const run = {
      id: `strava_${activity.id}`,
      date: new Date(activity.start_date),
      source: 'strava',
      distance: activity.distance, // meters
      duration: activity.moving_time, // seconds
      avgPace: paceSecondsPerKm,
      avgNPI: npi,
      avgHeartRate: activity.average_heartrate || 0,
      avgCadence: activity.average_cadence ? activity.average_cadence * 2 : null, // Strava cadence is steps/min, we want strides/min
      routeData: [], // Will fetch if needed
      formScore: null,
      formSessionId: null,
      // Strava-specific metadata
      stravaId: activity.id,
      stravaName: activity.name,
      stravaDescription: activity.description,
      elevationGain: activity.total_elevation_gain,
    };

    runs.push(run);
  }

  return runs;
}

/**
 * Calculate NPI from distance and pace
 * (Already defined above, this is just for reference)
 */

/**
 * Fetch detailed activity data (for route, splits, etc.)
 */
async function fetchActivityDetails(accessToken, activityId) {
  try {
    const response = await fetch(`${STRAVA_API_URL}/activities/${activityId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn(`Failed to fetch details for activity ${activityId}:`, error.message);
    return null;
  }
}

/**
 * Import runs to IndexedDB via browser storage service
 * Since we're in Node.js, we'll export to JSON and provide instructions
 */
function exportRunsToJSON(runs) {
  const outputPath = join(__dirname, '../strava-runs-import.json');
  const json = JSON.stringify(runs, null, 2);
  writeFileSync(outputPath, json);
  console.log(`\n💾 Exported ${runs.length} runs to: ${outputPath}`);
  return outputPath;
}

/**
 * Main import function
 */
async function main() {
  try {
    console.log('\n🏃 Strava Import Script');
    console.log('=======================\n');

    // Check credentials
    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
      console.error('❌ Missing Strava API credentials');
      console.error('\n1. Go to: https://www.strava.com/settings/api');
      console.error('2. Create an application');
      console.error('3. Set environment variables:');
      console.error('   export STRAVA_CLIENT_ID=your_client_id');
      console.error('   export STRAVA_CLIENT_SECRET=your_client_secret');
      process.exit(1);
    }

    // Get access token
    const accessToken = await getAccessToken();

    // Fetch activities (optionally limited by STRAVA_DAYS)
    const activities = await fetchActivities(accessToken, {
      perPage: 200,
      maxPages: null, // Fetch all
      afterDays: STRAVA_DAYS,
    });

    // Convert to runs
    console.log('\n🔄 Converting activities to runs...');
    const runs = convertToRuns(activities);
    console.log(`✅ Converted ${runs.length} runs`);

    // Optionally fetch detailed data for a sample
    if (runs.length > 0 && process.env.FETCH_DETAILS === 'true') {
      console.log('\n📊 Fetching detailed data for first 5 runs...');
      for (let i = 0; i < Math.min(5, runs.length); i++) {
        const details = await fetchActivityDetails(accessToken, runs[i].stravaId);
        if (details) {
          // Add route data if available
          if (details.map && details.map.polyline) {
            // Decode polyline if needed
            runs[i].routePolyline = details.map.polyline;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
      }
    }

    // Export to JSON
    const jsonPath = exportRunsToJSON(runs);
    console.log(`💾 Exported runs to ${jsonPath}`);

    // Instructions for importing
    console.log('\n📋 Next Steps:');
    console.log('==============\n');
    console.log('1. Open your web app in browser');
    console.log('2. Open browser console (F12)');
    console.log('3. Run this code:\n');
    console.log(`   const runs = ${JSON.stringify(runs.slice(0, 1), null, 2)}; // Sample`);
    console.log(`   // Or load from file: const runs = await fetch('/strava-runs-import.json').then(r => r.json());`);
    console.log(`   const { StorageService } = await import('/src/services/storageService.js');`);
    console.log(`   const { Run } = await import('/src/models/Run.js');`);
    console.log(`   for (const runData of runs) {`);
    console.log(`     const run = Run.fromJSON(runData);`);
    console.log(`     await StorageService.saveRun(run);`);
    console.log(`   }`);
    console.log(`   console.log('✅ Imported', runs.length, 'runs');`);
    console.log('\n4. Or use the browser import script (see strava-import-browser.js)\n');

    console.log('✨ Import complete!\n');

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
