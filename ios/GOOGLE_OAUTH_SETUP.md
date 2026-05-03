# Google OAuth Setup for Kinetix

## End-User Experience
End users don't need to do any technical setup. They just tap "Connect Google Drive" in Settings and sign in with their Google account.

## Developer Setup (Once)

Kinetix uses a secure OAuth proxy architecture. The Google Client Secret is stored on the backend (Vercel) and is never shipped in the iOS application bundle.

### 1. Create OAuth Credentials in Google Cloud Console

**⚠️ IMPORTANT: Use "Web application" type, NOT "iOS"**

For OAuth flows with ASWebAuthenticationSession using a backend proxy, you need a **Web application** client.

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project.
3. Navigate to **APIs & Services** > **Credentials**.
4. Click **+ CREATE CREDENTIALS** > **OAuth client ID**.
5. Select **Web application** as the application type.
6. Enter a **Name**: "Kinetix Backend Proxy".
7. Under **Authorized redirect URIs**, add:
   - `https://kinetix.bookiji.com/api/google-oauth` (Production)
   - `http://localhost:3000/api/google-oauth` (Local development)
8. Click **Create**.
9. **Copy the Client ID and Client Secret**.

### 2. Configure Backend Environment Variables

Add the following to your Vercel project environment variables (or `.env` for local API development):

- `GOOGLE_CLIENT_ID`: Your Google Client ID
- `GOOGLE_CLIENT_SECRET`: Your Google Client Secret

### 3. Update iOS App Configuration

1. Open `ios/KinetixPhone/Config/KinetixPublic.xcconfig`.
2. Update `GOOGLE_CLIENT_ID` with your actual Client ID.
3. Ensure `KINETIX_WEB_BASE_URL` points to your backend.

The iOS app uses `kinetix://oauth/google/callback` as the `redirect_uri` in its internal flow, which is handled by the backend proxy to match Google's requirements.

### 4. Enable Google Drive API

1. Go to **APIs & Services** > **Library**.
2. Search for "Google Drive API" and click **Enable**.

## Security Notes

- **Never** add `GOOGLE_CLIENT_SECRET` to `Info.plist` or any `.xcconfig` file that is bundled with the app.
- The iOS app communicates with `/api/google-oauth` and `/api/google-refresh` to exchange and refresh tokens securely.
