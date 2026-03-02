# Supabase Sync (Kinetix Web)

This project is now wired to Supabase at `https://scrmfcvmgafnkctbhmfu.supabase.co`.

## Env

Add to `web/.env.local` (already present):
```
VITE_SUPABASE_URL=https://scrmfcvmgafnkctbhmfu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcm1mY3ZtZ2FmbmtjdGJobWZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4NzM0OTIsImV4cCI6MjA2MzQ0OTQ5Mn0.08UECoDCJeZn_XSCYF8UOEecrCqcfHbWSCv85uJCsX4
```

## Using it in the app
1) `npm run dev`
2) In Settings → Cloud Sync (Supabase):
   - Connect via Google OAuth (make sure Google provider is enabled in the Supabase dashboard with redirect `https://scrmfcvmgafnkctbhmfu.supabase.co/auth/v1/callback` and local origins `http://localhost:5173`, `http://127.0.0.1:5173`).
   - Click “Sync now” to push local runs and pull remote runs (last-write-wins on `updated_at`).

## RLS status
RLS enabled on `public.user_hrv_history` with per-user policies (owner column `user_id`). Verified via `pg_policies`.

## Tables expected for sync
`runs` (schema: public) with columns similar to:
- `id` (uuid/text, pk), `user_id` (uuid), `date` (timestamptz), `distance_m`, `duration_s`, `avg_pace_skm`, `avg_npi`, `avg_hr`, `avg_cadence`, `elevation_gain_m`, `strava_id`, `strava_name`, `strava_description`, `updated_at`.

Row-level security should enforce `user_id = auth.uid()`. Add policies/indexes accordingly if not already present.

## Testing
- `npm run lint`, `npm test`, `npm run build` pass with Supabase dependency installed.
- Manual: Connect → Sync Now; verify runs are persisted and reloaded after refresh.
