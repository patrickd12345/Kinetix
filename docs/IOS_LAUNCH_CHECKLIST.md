# iOS + watchOS App Store launch (Lane B)

**Branch:** `feat/native-store-ready`  
**Owner:** Lane B (Kinetix-native worktree). Do not edit the parent Kinetix web repo from this lane.

**Last updated:** 2026-04-27

## B1 — Secrets removed from bundle (status: done in tree)

- **Info.plist:** Removed `GEMINI_API_KEY`, `STRAVA_CLIENT_SECRET`, `WITHINGS_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`, and all previously embedded third-party secrets.
- **Public IDs / URLs:** `STRAVA_CLIENT_ID`, `WITHINGS_CLIENT_ID`, `GOOGLE_CLIENT_ID`, `KINETIX_WEB_BASE_URL`, `SUPABASE_*`, `SENTRY_DSN` come from `ios/KinetixPhone/Config/*.xcconfig` (`$(VAR)` substitution into Info.plist).
- **Strava:** OAuth token exchange + refresh call Kinetix web `POST /api/strava-oauth` and `POST /api/strava-refresh` (no client secret on device).
- **Gemini:** Removed BYOK bundle keys; `GeminiProxyService` throws `"needs server proxy from Lane A"` until a Lane A endpoint exists.
- **Privacy manifest:** `ios/KinetixPhone/PrivacyInfo.xcprivacy` added to the KinetixPhone target Resources (via `watchos/project.yml`).
- **Credential rotation (human / vendor consoles — coordinated with Lane A for Strava OAuth):**
  - Rotate **Google AI / Gemini key** exposed in Git history (`GEMINI_API_KEY`).
  - Rotate **Strava API client secret** (and confirm **Strava app redirect URI** lists `kinetix://auth/strava` + server callback as required).
  - Treat **Strava client id** and **Google OAuth ids** as compromised for rotation policy if repo was public; regenerate in vendor consoles if required by security policy.

### Lane A handoffs

- **Withings:** iOS still expects a server-side OAuth/token path before re-enabling; do not embed `WITHINGS_CLIENT_SECRET` in the app.
- **Gemini:** Add an authenticated **`POST /api/gemini-proxy`** (or equivalent) before enabling cloud Gemini from native.
- **Strava `/api/strava-oauth` CORS / origin:** Native apps may omit `Origin`; confirm the handler allows Strava exchanges from non-browser clients if 403 appears.

### Build verification (macOS required)

Lane B agent environment was **Windows** — **did not run** `xcodegen generate` / `xcodebuild` here.

On a Mac, from `watchos/`:

```bash
xcodegen generate
xcodebuild -project KinetixWatch.xcodeproj -scheme KinetixPhone -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build-for-testing
```

Record failures under the step below.

### Native audit runbook (device — human)

Follow `docs/audit/KINETIX_NATIVE_AUDIT_RUNBOOK.md` once on a **paired physical iPhone + Watch** before TestFlight RC; attach screenshots/logs (redact tokens) to PR or this doc.

---

## Submission log

| Date | Step | Artifact / ID | Notes |
|------|------|-----------------|-------|
| 2026-04-27 | B1 | Commit `lane B B1` | Secrets stripped; PrivacyInfo; Strava via server |
| 2026-04-27 | B2 | Commit `lane B B2` | Supabase + entitlement gate; platform sync stub |
| 2026-04-27 | B3 | Commit `lane B B3` | Safari billing sheet; reader-app posture documented |
| 2026-04-27 | B4 | Commit `lane B B4` | Garmin service deleted; Feature flag documented |
| 2026-04-27 | B5 | Commit `lane B B5` | No Push capability; Sentry gated Device/Release |
| 2026-04-27 | B6 | Commit `lane B B6` | native-ci.yml; placeholder workflow removed |

---

## B7 — App Store Connect package (draft for submission)

### Binary & signing

- Archive **KinetixPhone** scheme (embeds Watch). Follow **`watchos/SIGNING_FIX_PLAN.md`** / **`watchos/WATCH_INSTALL_FIX.md`** for team IDs, companion bundle IDs, first-install via iPhone Watch app.

### Assets to prepare (human)

| Asset | Notes |
|-------|--------|
| App icon 1024×1024 | Master for ASC; generate required smaller sizes via Asset Catalog / Xcode |
| iPhone screenshots | 6.7", 6.5", 5.5" — Hero: coach/history/settings flows |
| Watch screenshots | 49mm, 45mm, 41mm — Active run + summary if applicable |

### App Privacy (questionnaire draft — align to actual binary)

| Data type | Collected? | Linked to user? | Used for tracking? | Purpose |
|-----------|------------|-----------------|---------------------|---------|
| Location | Yes | Yes | No | App functionality (run tracking, maps) |
| Fitness / Health | Yes | Yes | No | App functionality (workouts, HR, metrics) |
| Identifiers (account) | Yes | Yes | No | App functionality (Supabase auth, entitlement check); not used for cross-app ads |

### Age rating & compliance

- **Violence / mature themes:** None expected → lowest appropriate rating; disclose **fitness exertion** if prompted.
- **Account:** Sign-in via Supabase (when configured).
- **Support URL:** `https://kinetix.bookiji.com/help` (confirm live).
- **Marketing URL:** `https://kinetix.bookiji.com` (confirm live).

### Demo account (for reviewers)

- **Lane A / ops:** Provide a **non-production** or **scoped** demo email + magic-link or password per security policy; **do not** paste secrets into this repo.

### Submission log (ASC)

| Step | Date | Build | Submission ID | Status / ETA |
|------|------|-------|----------------|--------------|
| TestFlight internal | | | | |
| App Store review | | | | |
| B7 checklist drafted (no ASC IDs yet) | 2026-04-27 | — | — | Lane B agent |


---

## Status line (rolling)

- **2026-04-27:** B1 committed — rotation still required in vendor consoles; macOS build not executed in agent VM.
- **2026-04-27:** B2 committed — Supabase SDK + entitlement gate; `GET /api/entitlements` is a Lane A handoff until live.
- **2026-04-27:** B7 draft — ASC questionnaire/screenshot/asset checklist captured below; **no TestFlight / review submission IDs yet** (human-operated).

---

## B2 — Supabase auth + entitlement gate (status: done in tree)

- **Packages:** `Supabase` SwiftPM (`watchos/project.yml`).
- **Auth:** `AuthService` wraps `SupabaseClient`; session restored via `bootstrap()` on app launch.
- **Entitlements:** `EntitlementService` calls `GET {KINETIX_WEB_BASE_URL}/api/entitlements?product_key=kinetix` with `Authorization: Bearer <JWT>`.
- **Paid surfaces:** While `Features.requireEntitlementForPaidSurfaces` is true and the API returns inactive / missing, **Cloud Storage** and **Strava** sections are replaced by `entitlementGateSection`.

### Lane A handoffs

- Implement **`GET /api/entitlements`** with JSON body per contract:

```json
{ "active": true, "ends_at": "2026-12-31T23:59:59Z", "source": "stripe" }
```

(`ends_at` nullable when lifetime / trial without end)

- Implement **`POST /api/platform-profile/sync`** (or rename consistently) for `PlatformIdentityService.syncToPlatform` — currently logs when non-200.

---

## B3 — Reader app / no IAP (status: done in tree)

- **StoreKit:** not integrated; no in-app purchase APIs.
- **Neutral account link:** `ManageAccountOnWebButton` + `SubscriptionLinkView` (`ios/KinetixPhone/Views/Settings/SubscriptionLinkView.swift`) present `https://kinetix.bookiji.com/billing` in **`SFSafariViewController`** using the label **Manage your account** (no Subscribe / Upgrade / Premium / Buy strings).
- **Apple guideline:** App Store Review Guideline **3.1.3(a) “Reader” Apps** — digital content/services purchased elsewhere may be accessed if the app does not steer users to purchasing using means other than IAP inside the app. This build uses a neutral external link only.

---

## B4 — Garmin removed for v1 (status: done in tree)

- **Code:** `ios/KinetixPhone/Services/GarminService.swift` **deleted**; Home/Settings/Technical Insights no longer reference it. `Features.garminEnabled` is `false` in `Features.swift` for re-enable after **Lane C** (server-normalized Garmin data + web sync).
- **Re-enable (post–Lane C):** restore a client that reads Kinetix server APIs (not simulated device “connect”); set `Features.garminEnabled = true` and reintroduce UI with real OAuth/server token flow per coordination contract.

---

## B5 — Push capability removed + Sentry (status: done in tree)

- **Capabilities:** `watchos/project.yml` — removed **Push Notifications** and **`remote-notification`** background mode from **KinetixPhone** (v1 does not register for APNs).
- **Sentry:** SPM package `sentry-cocoa`; `KinetixSentry.configure()` reads **`SENTRY_DSN`** from Info.plist (`$(SENTRY_DSN)` from xcconfig). Initializes only on **physical device Release** builds (`tracesSampleRate = 0.1`); **disabled on Simulator and Debug**.

---

## B6 — Native CI + device audit evidence (status: CI workflow in repo; device audit human)

- **Workflow:** `.github/workflows/native-ci.yml` replaces the placeholder. Triggers on **PR + push to `main`** when `ios/**`, `watchos/**`, or the workflow changes. Runner **`macos-14`**, **`maxim-lobanov/setup-xcode@v1`**, **`brew install xcodegen`**, `xcodegen generate`, **`xcodebuild build-for-testing`** for **KinetixPhone** (generic iOS) and **KinetixWatch** (watchOS Simulator), then **`test-without-building`** for **`KinetixHostUITests`**. **xcresult** artifacts upload on failure.
- **Simulator name:** `WATCH_SIM` env may need updating when GitHub’s Xcode image changes Watch simulator catalog (see failing job log).
- **Physical device audit (human):** Run **`docs/audit/KINETIX_NATIVE_AUDIT_RUNBOOK.md`** once on paired iPhone + Watch before RC; paste PASS/FAIL + build numbers below.

### Device audit record (fill on hardware)

| Run date | iOS / watchOS | Build | Flows (watch start/pause, phone shell, settings) | Evidence links |
|----------|----------------|-------|--------------------------------------------------|----------------|
|          |                |       |                                                  |                |

