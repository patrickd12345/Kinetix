# Signing Fix Plan

## Current Issue
Xcode keeps creating iOS provisioning profiles instead of watchOS, even with correct settings.

## Strategy
1. **First**: Get signing to work WITHOUT Location Services
   - Removed Location Services capability temporarily
   - This should let Xcode create a basic watchOS profile
   
2. **Then**: Add Location Services back
   - Once signing works, we'll add the capability back
   - Xcode should then update the profile to include location services

## Steps in Xcode:
1. Close and reopen Xcode (⌘Q, then reopen)
2. Go to Signing & Capabilities
3. Click "Try Again"
4. If it works (no errors), we'll add Location Services back
5. If it still fails, we may need to try building for simulator first

