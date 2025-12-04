# Apple Watch Connection Troubleshooting

## Error: "A networking error occurred; The device rejected the connection request"

This is a common Xcode/device connection issue. Try these solutions in order:

### Quick Fixes (Try First)

1. **Unlock Your Watch**
   - Make sure your Apple Watch is unlocked (enter passcode if needed)
   - Keep it on your wrist or on the charger

2. **Restart Xcode**
   - Quit Xcode completely (Cmd+Q)
   - Reopen the project
   - Try running again

3. **Build iPhone App First**
   - Select **KinetixPhone** scheme
   - Build and run on iPhone first (Cmd+R)
   - Then switch to **KinetixWatch** scheme and run

4. **Check Device Connection**
   - In Xcode: Window → Devices and Simulators
   - Verify both iPhone and Watch are connected
   - If Watch shows "Preparing...", wait for it to finish

### Advanced Fixes

5. **Clean Build Folder**
   ```
   Product → Clean Build Folder (Shift+Cmd+K)
   ```
   Then rebuild

6. **Reset Derived Data**
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/KinetixWatch-*
   ```
   Then reopen Xcode

7. **Check Code Signing**
   - Select **KinetixWatch** target
   - Go to Signing & Capabilities
   - Verify Team is selected
   - Check that Bundle ID matches: `com.patrickduchesneau.KinetixPhone.watchkitapp`

8. **Verify Watch App is Embedded**
   - Select **KinetixPhone** target
   - Go to Build Phases
   - Check "Embed Watch Content" phase includes `KinetixWatch.app`

9. **Restart Devices**
   - Restart your iPhone
   - Restart your Apple Watch
   - Reconnect in Xcode

10. **Check Watch App Installation**
    - On iPhone, open Watch app
    - Scroll to find "Kinetix"
    - If it shows "Not Installed", tap to install
    - Wait for installation to complete

### Nuclear Option

11. **Remove and Re-add Devices**
    - In Xcode: Window → Devices and Simulators
    - Right-click on your Watch → "Unpair"
    - Re-pair the Watch
    - Rebuild and run

### Verification Checklist

✅ Watch is unlocked  
✅ iPhone and Watch are on same WiFi/Bluetooth  
✅ Both devices are trusted in Xcode  
✅ Code signing is configured correctly  
✅ Bundle IDs match (iPhone: `com.patrickduchesneau.KinetixPhone`, Watch: `com.patrickduchesneau.KinetixPhone.watchkitapp`)  
✅ Watch Info.plist has `WKCompanionAppBundleIdentifier` = `com.patrickduchesneau.KinetixPhone`  
✅ KinetixPhone target embeds KinetixWatch  

### Most Common Solution

**90% of the time, this fixes it:**
1. Unlock your Watch
2. Quit Xcode (Cmd+Q)
3. Reopen Xcode
4. Build iPhone app first (KinetixPhone scheme)
5. Then build Watch app (KinetixWatch scheme)

### Still Not Working?

Check Xcode console for specific errors:
- View → Debug Area → Activate Console (Shift+Cmd+Y)
- Look for specific error messages about signing, bundle IDs, or device connection


