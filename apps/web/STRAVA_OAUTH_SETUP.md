# Strava OAuth Setup

## Quick Setup

The app now uses OAuth2 flow to get Strava tokens with the correct `activity:read_all` scope.

### 1. Configure Strava API Application

1. Go to https://www.strava.com/settings/api
2. Find your **Client ID** (you already have: `157217`)
3. Click "Show" next to **Client Secret** and copy it
4. Scroll down to **Authorization Callback Domain**
5. Add your domain (e.g., `your-app.vercel.app` or `localhost` for local dev)
6. Save the application

### 2. Set Environment Variables in Vercel

```bash
# Required for OAuth token exchange
STRAVA_CLIENT_SECRET=your_client_secret_here
STRAVA_CLIENT_ID=157217  # Optional, defaults to 157217
```

To set in Vercel:
```bash
vercel env add STRAVA_CLIENT_SECRET
# Paste your client secret when prompted
```

Or via Vercel dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add `STRAVA_CLIENT_SECRET` with your client secret value

### 3. For Local Development

Create `apps/web/.env.local`:
```bash
VITE_STRAVA_CLIENT_ID=157217
VITE_STRAVA_REDIRECT_URI=http://localhost:5173/settings
STRAVA_CLIENT_SECRET=your_client_secret_here
```

**Important:** The `STRAVA_CLIENT_SECRET` must be set in `.env.local` for local development. The Vite dev server includes a plugin that handles the OAuth endpoint locally, so you don't need Vercel CLI for local testing.

### 4. How It Works

1. User clicks "Connect with Strava" button
2. Redirects to Strava authorization page
3. User authorizes the app with `activity:read_all` scope
4. Strava redirects back with authorization code
5. Serverless function exchanges code for access token
6. Token is stored and used for API calls

### Manual Token Entry (Fallback)

Users can still paste a token manually if they have one with the right scope, but OAuth is the recommended method.
