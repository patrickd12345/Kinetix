# KINETIX IOS + WATCH TESTFLIGHT CHECKLIST

## 1. Purpose
This checklist is for native iPhone + Apple Watch TestFlight beta readiness.

## 2. Scope
**Include:**
- iPhone app
- Apple Watch companion app
- HealthKit
- Location
- workout tracking
- Watch connectivity
- run save/history

**Explicitly exclude:**
- web beta
- AdSense
- AdMob
- Stripe/subscriptions
- real Garmin MCP
- public App Store launch polish

## 3. Project generation
Execute the following to generate the project fresh from xcodegen:
```bash
cd watchos
xcodegen generate
```

## 4. Signing check
Verify that the project configurations map correctly:
- Team: AWJBX83Y4X
- iPhone bundle ID: com.patrickduchesneau.KinetixPhone
- Watch bundle ID: com.patrickduchesneau.KinetixPhone.watchkitapp

## 5. Watch embedding check
Confirm Xcode settings:
- KinetixPhone embeds KinetixWatch.
- WKCompanionAppBundleIdentifier points to `com.patrickduchesneau.KinetixPhone`.
- Watch bundle ID remains child of iPhone bundle ID.

## 6. Manual build verification
*(Note: Native build commands were not run during automated preparation because the execution environment is Linux. Run these manually on macOS.)*

Manual iPhone build settings check:
```bash
xcodebuild \
  -project KinetixWatch.xcodeproj \
  -scheme KinetixPhone \
  -configuration Debug \
  -showBuildSettings
```

Manual iPhone simulator destination discovery:
```bash
xcodebuild \
  -showdestinations \
  -project KinetixWatch.xcodeproj \
  -scheme KinetixPhone
```

Manual iPhone simulator build (adjust name based on showdestinations output):
```bash
xcodebuild \
  -project KinetixWatch.xcodeproj \
  -scheme KinetixPhone \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  build
```

Manual Watch simulator destination discovery:
```bash
xcodebuild \
  -showdestinations \
  -project KinetixWatch.xcodeproj \
  -scheme KinetixWatch
```

Manual Watch simulator build (adjust name based on showdestinations output):
```bash
xcodebuild \
  -project KinetixWatch.xcodeproj \
  -scheme KinetixWatch \
  -configuration Debug \
  -destination 'platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)' \
  build
```

## 7. Archive and upload
1. Open `watchos/KinetixWatch.xcodeproj`
2. Select `KinetixPhone` scheme
3. Select `Any iOS Device` / real device target as appropriate
4. Product -> Archive
5. Validate archive
6. Distribute App -> App Store Connect
7. Upload
8. Wait for processing
9. Add to internal TestFlight group

## 8. Internal TestFlight iPhone checklist
- [ ] app installs
- [ ] app launches
- [ ] HealthKit permission prompt appears
- [ ] location permission prompt appears
- [ ] permission denial does not crash
- [ ] start run screen opens
- [ ] run starts
- [ ] elapsed time updates
- [ ] distance updates
- [ ] heart rate updates when available
- [ ] stop run works
- [ ] save run works
- [ ] invalid run is rejected or clearly explained
- [ ] history shows saved run
- [ ] KPS/result displays after run
- [ ] settings opens
- [ ] Watch unavailable path is clear

## 9. Internal TestFlight Apple Watch checklist
- [ ] Watch companion installs
- [ ] Watch app launches
- [ ] Watch HealthKit/workout permission path works
- [ ] start workout works
- [ ] elapsed time updates
- [ ] heart rate updates when available
- [ ] pace/distance updates when available
- [ ] pause/resume works
- [ ] stop workout works
- [ ] invalid workout save is rejected or clearly explained
- [ ] run syncs to iPhone or exact limitation is documented
- [ ] Watch unavailable path on iPhone is clear

## 10. Watch pairing reality
- Watch paired: companion installs and launches.
- Watch not paired: iPhone app still usable.
- Watch paired but unavailable: show clear fallback, no crash.

## 11. Sensor availability matrix
- Simulator: mock/limited sensors only.
- Real iPhone: GPS/location; heart rate only if available from HealthKit/external source.
- Apple Watch: best source for live HR and workout session data.

## 12. App Review rejection traps
- no missing purpose string crash
- no unused permission requested
- no medical claims
- no broken Watch companion
- no non-functional feature exposed as complete
- no ads in beta
- no payments in beta

## 13. Known beta limitations
- Garmin integration not active.
- Some sensor data may be simulated or unavailable in simulator.
- Watch sync may be partial depending on pairing state.
- No subscription / Pro features.
- No AdMob.
- No public App Store metadata polish.
- Recovery coaching foundation may exist backend-side but is not the beta validation focus.

## 14. Go / no-go table

| Area | PASS | BLOCKED | Notes |
|------|------|---------|-------|
| Project generation | | | |
| iPhone build | | | |
| Watch build | | | |
| iPhone launch | | | |
| Watch launch | | | |
| HealthKit permissions | | | |
| Location permissions | | | |
| Run start/stop/save | | | |
| Watch workout start/stop/save | | | |
| Watch sync | | | |
| History/KPS result | | | |
| App Review privacy strings | | | |
| TestFlight upload | | | |
