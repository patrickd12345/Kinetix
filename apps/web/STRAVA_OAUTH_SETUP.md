# Strava OAuth Setup

## Quick Setup

The app uses OAuth2 with the `activity:read_all` scope. Token material is stored server-side in the Kinetix provider token vault; the browser only keeps non-secret connection state.

### 1. Configure Strava API Application

1. Go to https://www.strava.com/settings/api
2. Find your **Client ID** (you already have: `157217`)
3. Click "Show" next to **Client Secret** and copy it
4. Scroll down to **Authorization Callback Domain**
5. Set to your production domain only (e.g. `kinetix.bookiji.com`). Localhost is whitelisted by Strava.
6. Save the application

### 2. Set Environment Variables in Vercel

```bash
# Required for OAuth token exchange
STRAVA_CLIENT_SECRET=your_client_secret_here
STRAVA_CLIENT_ID=157217  # Optional, defaults to 157217

# Required for production: OAuth redirect must match Strava callback domain
VITE_STRAVA_REDIRECT_URI=https://kinetix.bookiji.com/settings
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
STRAVA_CLIENT_SECRET=your_client_secret_here
```

**Important:** The `STRAVA_CLIENT_SECRET` must be set in `.env.local` for local development. The Vite dev server includes a plugin that handles the OAuth endpoint locally. Do not set `VITE_STRAVA_REDIRECT_URI` locally; the app uses `window.location.origin` so localhost works automatically.

### 4. How It Works

1. User clicks "Connect with Strava" button
2. Redirects to Strava authorization page
3. User authorizes the app with `activity:read_all` scope
4. Strava redirects back with authorization code
5. Serverless function exchanges code, stores provider tokens in `kinetix.provider_token_vault`, and returns connection state
6. Browser imports runs through the authenticated Kinetix Strava proxy; provider tokens are never returned to client state

### Manual Token Entry

Manual token entry is no longer supported for Kinetix-managed Strava sync. Use OAuth connect/reconnect so refresh-token ownership stays server-side.
