# Phase 4 - Interactive runbook

**Audience:** human operator with Bookiji org admin + Supabase service-role + Vercel admin.
**Companion:** [`PHASE4_RELEASE_EVIDENCE.md`](PHASE4_RELEASE_EVIDENCE.md) (where results land).

## Pre-flight (5 min, scripted)

```bash
pnpm lint
pnpm type-check
pnpm --filter @kinetix/web test
pnpm verify:kinetix-parity
pnpm infisical:list-keys
# Read-only: lists secret *names* at /platform and /kinetix for prod+dev via `infisical export` (no values).
# Full umbrella parity (includes products/bookiji Next.js build — needs RAM; omit if Bookiji OOM on this machine):
# pnpm verify:vercel-parity
infisical run --env=prod --path=/platform -- node scripts/phase4/verify-sso.mjs --user <test-email> --prod
```

`verify:kinetix-parity` mirrors Vercel's Kinetix install + `pnpm run build` without the Bookiji step. All must be PASS before interactive steps. Re-run `verify-sso.mjs` and capture the markdown row for evidence.

## SSO closure (15 min, human)

1. Open a clean Chrome profile (no existing Bookiji session).
2. Go to `https://app.bookiji.com/login` -> click **Sign in with Google**.
3. Complete Google flow. Use the **`pilotmontreal`** Google account per workspace rule (`memory-google-account-pilotmontreal`).
4. In a new tab, open `https://kinetix.bookiji.com` - expect Kinetix UI without a login wall.
5. Click Profile/Settings - confirm correct email is shown.
6. Record PASS/FAIL in [`PHASE4_RELEASE_EVIDENCE.md`](PHASE4_RELEASE_EVIDENCE.md) under "Interactive closure session" -> "Bookiji-first SSO".

## Entitlement gating (10 min, scripted + human)

Pre-condition: pick a non-billing test user `<TEST_USER_ID>` (uuid). The migration `<ts>_phase4_entitlement_toggle_helpers.sql` adds two service-role-only helper functions.

```sql
-- Run via Supabase SQL Editor signed in as project admin (service role).
-- Returns one row with the previous active state.
select * from platform.test_revoke_kinetix_entitlement('<TEST_USER_ID>');
```

1. As that user, refresh `https://kinetix.bookiji.com` - expect "Entitlement required" page.
2. Restore:

```sql
select * from platform.test_restore_kinetix_entitlement('<TEST_USER_ID>', null);
```

3. Refresh - expect Kinetix UI again.
4. Record evidence row.

## Supabase Auth dashboard review (10 min, human)

Open Supabase project -> **Authentication** -> **URL Configuration**:

- Site URL: `https://app.bookiji.com`
- Redirect URLs include:
  - `https://kinetix.bookiji.com/*`
  - `https://app.bookiji.com/*`
  - `https://*-kinetix.vercel.app/*`
  - `http://localhost:3000/*` (dev only)

Authentication -> **Providers**:

- Email (magic link): enabled
- Google OAuth: enabled with prod client id/secret
- Apple / Microsoft: enabled only if shipping (otherwise leave disabled)

Record evidence row.

## Stripe live cutover (30 min, human + scripted)

1. In Stripe Dashboard -> **Live mode** -> confirm product + price exist for Kinetix.
2. Set Vercel env (production) for **both** Bookiji and Kinetix projects:
   - `BILLING_ENABLED=1`
   - `STRIPE_SECRET_KEY=sk_live_...`
   - `KINETIX_STRIPE_PRICE_ID=price_...`
   - On Bookiji only: `STRIPE_WEBHOOK_SECRET=whsec_...` and configure the live webhook endpoint.
3. Mirror to Infisical (`/platform`, `/myassist` if shared).
4. Verify:

```bash
infisical run --env=prod --path=/platform -- node scripts/phase4/verify-stripe-live.mjs
```

5. Real checkout: log in as a test user, complete checkout with a real card.
6. Confirm `platform.entitlements` row appears with `product_key='kinetix'`, `active=true`.
7. Refresh Kinetix - gate opens. Record evidence.

## Help Center + operator + a11y matrix (60-90 min, human)

Follow [`PHASE4_OPERATOR_SMOKE.md`](PHASE4_OPERATOR_SMOKE.md) and the a11y matrix in [`deployment/KINETIX_VERIFICATION_CHECKLIST.md`](deployment/KINETIX_VERIFICATION_CHECKLIST.md). Record per-row evidence.

## Stop conditions

- Any step that needs Bookiji org admin / Supabase org owner / Apple Developer admin -> stop, document the blocker in evidence, wait. Do not invent fixes.
- Any test failure on the scripted block -> stop and triage before continuing.
