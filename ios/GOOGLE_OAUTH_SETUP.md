# Google OAuth Setup for iOS

## ⚠️ IMPORTANT: This is Developer Setup Only

**You (the developer) do this ONCE.** End users don't need to do any of this - they just tap "Connect Google Drive" and sign in with their Google account.

## Quick Setup Guide (Developer Only)

### 1. Create OAuth Credentials in Google Cloud Console

**⚠️ IMPORTANT: Use "Web application" type, NOT "iOS"**

For OAuth flows with ASWebAuthenticationSession, you need a **Web application** client because:
- iOS clients don't support custom redirect URIs in Google Cloud Console
- Web clients support HTTP redirect URIs (required by Google)
- ASWebAuthenticationSession handles the actual callback via custom URL scheme

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** > **Credentials**
4. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
5. Select **Web application** as the application type (NOT iOS)
6. Enter a **Name**: "Kinetix iOS OAuth" (or any name)
7. Under **Authorized redirect URIs**, click **+ ADD URI**
8. Add: `http://localhost/oauth/google/callback` (Google requires HTTP/HTTPS)
9. Click **Create**
10. **Copy the Client ID and Client Secret** (you'll need both!)

### 2. Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Fill in required fields:
   - **App name**: Kinetix
   - **User support email**: Your email
   - **Developer contact information**: Your email
3. Click **Save and Continue**
4. On **Scopes** page, click **Save and Continue** (we'll add scopes via API)
5. On **Test users** page:
   - **Add your Google account email** as a test user
   - This is required if app is in "Testing" mode
6. Click **Save and Continue**

### 3. Add Redirect URI

1. Go back to **APIs & Services** > **Credentials**
2. Click on your **iOS OAuth 2.0 Client ID**
3. Under **Authorized redirect URIs**, click **+ ADD URI**
4. Add: `com.kinetix.phone://oauth/google/callback`
5. Click **Save**

### 4. Enable Google Drive API

1. Go to **APIs & Services** > **Library**
2. Search for "Google Drive API"
3. Click on it and click **Enable**

### 5. Update Info.plist

1. Open `ios/KinetixPhone/Info.plist`
2. Replace `YOUR_GOOGLE_CLIENT_ID` with your actual Client ID
3. Replace `YOUR_GOOGLE_CLIENT_SECRET` with your actual Client Secret

### 6. Verify URL Scheme

The URL scheme is already configured in `Info.plist`:
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.kinetix.phone</string>
        </array>
    </dict>
</array>
```

## Common Issues

### "Access blocked: authorization error"

**Causes:**
1. Redirect URI not added in Google Cloud Console
2. App is in "Testing" mode and your email isn't added as a test user
3. Client ID/Secret mismatch

**Solutions:**
- Verify redirect URI: `com.kinetix.phone://oauth/google/callback` is in Authorized redirect URIs
- Add your email as a test user in OAuth consent screen
- Double-check Client ID and Secret in Info.plist match Google Cloud Console

### "Invalid client" error

- Verify Client ID and Secret are correct in Info.plist
- Make sure you're using the **iOS** OAuth client (not Web or Android)

### OAuth dialog doesn't open

- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in Info.plist
- Verify they're not still set to placeholder values

## Testing

After setup:
1. Build and run the app
2. Go to Settings
3. Tap "Connect Google Drive"
4. You should see Google's OAuth dialog
5. Sign in with your Google account (must be a test user if app is in Testing mode)
6. Grant permissions
7. You should be redirected back to the app

## Production

When ready for production:
1. Change OAuth consent screen to **Published**
2. Submit app for verification (if using sensitive scopes)
3. Remove test user restrictions

**Once published, ANY user can connect their Google Drive - no setup required on their end!**

## What End Users Experience

1. User opens Kinetix app
2. Goes to Settings → Cloud Storage
3. Taps "Connect Google Drive"
4. Google OAuth dialog appears
5. User signs in with their Google account
6. Grants permissions
7. Done! Their runs sync to their Google Drive automatically

**That's it - no technical setup, no credentials, no configuration. Just sign in and go.**

