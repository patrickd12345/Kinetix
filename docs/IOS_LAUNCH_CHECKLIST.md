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

---

## Status line (rolling)

- **2026-04-27:** B1 committed — rotation still required in vendor consoles; macOS build not executed in agent VM.
