# Google OAuth Setup for iOS

## ✅ FINAL CONFIGURATION

This setup uses the standard **iOS Client** flow with `ASWebAuthenticationSession`.

### 1. Google Cloud Console
1. Open your existing **iOS Client**.
   - Client ID: `915406480058-s855cf6s4dqipjskfqh0egqq1hui6frn.apps.googleusercontent.com`
   - Bundle ID: `com.patrickduchesneau.KinetixPhone`
2. **That's it.** No Redirect URI configuration is needed in the console for iOS clients.

### 2. Info.plist Configuration
We have already configured this for you:
- `GOOGLE_CLIENT_ID`: Set to your iOS Client ID.
- `CFBundleURLTypes`: Added the **Reversed Client ID** scheme (`com.googleusercontent.apps.9154...`).

### 3. How It Works
1. App launches `ASWebAuthenticationSession`.
2. Request sends `redirect_uri`: `com.googleusercontent.apps.[ID]:/oauth2redirect/google`.
3. Google authenticates and redirects to that custom scheme.
4. iOS intercepts the scheme and passes the code back to the app.
5. App exchanges code for tokens (no client secret needed for iOS).

### 4. Troubleshooting
- **"Access_blocked"**: Ensure your email is in the **Test Users** list in the OAuth Consent Screen.
- **"Invalid_redirect"**: Should not happen with this setup as we use the standard iOS redirect format.
