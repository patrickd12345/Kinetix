# Supabase Sync – iOS Plan

Goal: mirror the web Supabase sync on KinetixPhone so users can sync runs across devices without Google Drive.

## Libraries
- Add `supabase-swift` via Swift Package Manager:
  - URL: `https://github.com/supabase-community/supabase-swift`
  - Minimum iOS: 14+

## Config
- Add to `Info.plist` (or config constants):
  - `SUPABASE_URL` = `https://scrmfcvmgafnkctbhmfu.supabase.co`
  - `SUPABASE_ANON_KEY` = (anon key already in web `.env.local`)
  - Auth redirect: use a custom scheme, e.g., `kinetix://auth/supabase` (register URL scheme).
- Enable Google provider in Supabase (already needed for web) with redirect: `https://scrmfcvmgafnkctbhmfu.supabase.co/auth/v1/callback`.

## Service
- Create `SupabaseSyncService` (Swift) that:
  - Holds a Supabase client (`SupabaseClient` from supabase-swift).
  - Auth:
    - Sign in with OAuth Google: `client.auth.signInWithOAuth(.google, redirectTo: "kinetix://auth/supabase")`.
    - Persist session locally; restore on app launch.
  - Sync:
    - `pullRuns()` → select rows from `runs` table, map to SwiftData `Run`, upsert locally.
    - `pushRuns()` → read local `Run`s, map to rows, upsert via `rpc` or `from("runs").upsert(...)`.
    - Conflict: last-write-wins on `updated_at`.

## UI
- In `SettingsView.swift` add a new section “Cloud Sync (Supabase)”:
  - Connect/Disconnect (OAuth).
  - Buttons: “Sync Now”, “Upload Local Runs” (one-shot push).
  - Status text showing connected user email/id and last sync.

## Data mapping
- Table `runs` schema to match web:
  - `id` (uuid/text), `user_id` (uuid), `date` (timestamptz), `distance_m`, `duration_s`, `avg_pace_skm`, `avg_npi`, `avg_hr`, `avg_cadence`, `elevation_gain_m`, `strava_id`, `strava_name`, `strava_description`, `updated_at`.
- Map SwiftData `Run` fields accordingly; set `user_id = auth.user.id`.

## RLS
- Ensure policies in Supabase allow authenticated users to read/write their own rows (user_id = auth.uid()).
- Service role must stay server-side; app uses anon key.

## Testing
- Sign in on device A, Sync Now.
- Sign in on device B, Sync Now → runs appear.
- Edit/add a run on one device, Sync, then Sync on the other; last-write-wins by `updated_at`.

## Next steps to implement
1) Add supabase-swift dependency and config keys.
2) Implement SupabaseSyncService (auth + push/pull) using async/await.
3) Add Settings UI section with buttons/states.
4) Manual test on simulator/device with the shared Supabase project.
