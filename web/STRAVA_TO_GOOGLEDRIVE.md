# Strava to Google Drive Export

One-shot export of your last 90 days of Strava runs to Google Drive.

Tests are included: run `npm test` to cover converter math and token flows (Strava/Google mocked); see `scripts/` for test files.

## Quick Start

### 1. Get Strava API Credentials

1. Go to: https://www.strava.com/settings/api
2. Create an application
3. Save your **Client ID** and **Client Secret**

### 2. Get Google OAuth Credentials

1. Go to: https://console.cloud.google.com/
2. Navigate to **APIs & Services** > **Credentials**
3. Create **OAuth 2.0 Client ID** (select **Web application** type)
4. Add redirect URI: `http://localhost:8080/oauth/google/callback`
5. Save your **Client ID** and **Client Secret**

### 3. Run the Export Script

```bash
cd web

# Set Strava credentials
export STRAVA_CLIENT_ID=your_strava_client_id
export STRAVA_CLIENT_SECRET=your_strava_client_secret

# Set Google credentials
export GOOGLE_CLIENT_ID=your_google_client_id
export GOOGLE_CLIENT_SECRET=your_google_client_secret

# Optional: set range (defaults to 90 days)
export STRAVA_DAYS=180

# Run the script
node scripts/strava-to-googledrive.js
```

### 4. Authenticate (First Time Only)

**Strava Authentication:**
1. The script will show a Strava authorization URL
2. Visit the URL and authorize the app
3. Copy the authorization code from the redirect URL
4. Run: `STRAVA_CODE=your_code node scripts/strava-to-googledrive.js`

**Google Authentication:**
1. The script will show a Google authorization URL
2. Visit the URL and authorize the app
3. Copy the authorization code from the redirect URL
4. Run: `GOOGLE_CODE=your_code node scripts/strava-to-googledrive.js`

### 5. Save Tokens for Future Use

After first authentication, the script will output tokens. Save them:

```bash
# Strava tokens
export STRAVA_ACCESS_TOKEN=your_access_token
export STRAVA_REFRESH_TOKEN=your_refresh_token

# Google tokens
export GOOGLE_ACCESS_TOKEN=your_access_token
export GOOGLE_REFRESH_TOKEN=your_refresh_token
```

With tokens saved, you can run the script directly without OAuth flow.

## What Gets Exported

- ✅ **Last 90 days** of Strava running activities
- ✅ **Distance, Duration, Date/Time**
- ✅ **Average Pace** (calculated)
- ✅ **NPI** (calculated from distance and pace)
- ✅ **Heart Rate** (if available)
- ✅ **Cadence** (if available)
- ✅ **Elevation Gain**
- ✅ **Strava ID and metadata**

## Output

The script will:
1. Fetch last 90 days of activities from Strava
2. Convert to Kinetix Run format
3. Save locally as backup: `strava-runs-last-90-days-YYYY-MM-DD.json`
4. Upload to Google Drive in the "Kinetix" folder
5. Provide a link to view the file in Google Drive

## File Format

The exported JSON file contains an array of run objects:

```json
[
  {
    "id": "strava_123456789",
    "date": "2024-01-15T10:30:00.000Z",
    "source": "strava",
    "distance": 5000,
    "duration": 1800,
    "avgPace": 360,
    "avgNPI": 45.2,
    "avgHeartRate": 150,
    "avgCadence": 180,
    "elevationGain": 50,
    "stravaId": 123456789,
    "stravaName": "Morning Run",
    ...
  }
]
```

## Troubleshooting

### "Missing Strava API credentials"
- Make sure you've set `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`
- Get them from: https://www.strava.com/settings/api

### "Missing Google OAuth credentials"
- Make sure you've set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Make sure you created a **Web application** type OAuth client
- Add redirect URI: `http://localhost:8080/oauth/google/callback`

### "Token exchange failed"
- Make sure authorization codes are fresh (they expire quickly)
- Check that redirect URIs match your app settings

### "Rate limit exceeded" (Strava)
- Strava allows 600 requests per 15 minutes
- Wait 15 minutes and try again
- The script includes delays to respect rate limits

## Security Notes

- ⚠️ **Never commit** your credentials or tokens to git
- ⚠️ **Access tokens expire** - use refresh tokens for long-term access
- ⚠️ **Store tokens securely** - use environment variables or a secrets manager
- A local backup JSON is written next to `web/scripts/`; Google Drive upload targets the "Kinetix" folder.
- Strava rate limits: 600 requests per 15 minutes; the script pauses between pages.

## Example Output

```
🏃 Strava to Google Drive Export
==================================

🔐 Authenticating with Strava...
✅ Strava token obtained

📥 Fetching last 90 days of activities from Strava...
   Date range: 2024-01-15 to 2024-04-15
   Fetched page 1: 50 activities (50 total)

✅ Fetched 50 total activities from last 90 days

🔄 Converting activities to runs...
✅ Converted 48 runs

💾 Saved locally as backup: strava-runs-last-90-days-2024-04-15.json

🔐 Authenticating with Google Drive...
✅ Google token refreshed

📁 Setting up Google Drive folder...
✅ Found existing "Kinetix" folder

☁️  Uploading to Google Drive...
   Filename: strava-runs-last-90-days-2024-04-15.json
   Size: 125.50 KB
   Runs: 48

✅ Successfully uploaded to Google Drive!
   File ID: 1a2b3c4d5e6f7g8h9i0j
   View at: https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view

✨ Export complete! 48 runs from last 90 days are now in Google Drive.
```

---

**Ready to export your Strava runs?** 🚀
