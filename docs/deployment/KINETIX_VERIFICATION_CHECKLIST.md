# kinetix.bookiji.com manual verification checklist

Run this after DNS, Supabase redirect URLs, and Kinetix env parity are in place.

> Phase 4 operators: start with [`../PHASE4_INTERACTIVE_RUNBOOK.md`](../PHASE4_INTERACTIVE_RUNBOOK.md) which sequences this checklist alongside the entitlement toggle migration ([`../../supabase/migrations/20260427180204_phase4_entitlement_toggle_helpers.sql`](../../supabase/migrations/20260427180204_phase4_entitlement_toggle_helpers.sql)) and Stripe live cutover.

## Admlog (production must stay disabled)

1. On **production** `kinetix.bookiji.com`, open `GET /api/admlog` (or use curl). **Confirm:** HTTP **403** and a response that does **not** instruct you to enable `ADMLOG_ENABLED` for production.
2. From the repo (with Infisical CLI): `node scripts/verify-infisical.mjs --env=prod` **Confirm:** exits **0** and does not flag `ADMLOG_ENABLED` in prod (see [ENV_PARITY.md](./ENV_PARITY.md#admlog-get-apiadmlog)).

## Shell and Help Center visual accessibility (light/dark, zoom, focus)

Use the authenticated web shell (Run Dashboard, sidebar, Help Center). Repeat each row in **light** and **dark** theme (theme control in the header).

| Check | 100% | 125% | 150% |
| --- | --- | --- | --- |
| Body text and section cards readable (no white-on-light or faint gray-only body copy) | | | |
| Active sidebar route clearly distinct from inactive items | | | |
| Focus ring visible on keyboard Tab (skip link, sidebar links, theme buttons, Help inputs/buttons) | | | |
| Disabled Search (empty query) and disabled quick-prompts while loading remain legible and obviously disabled | | | |
| Readonly or loading states (e.g. support search status) distinguishable from editable fields | | | |

**Notes:** Browser zoom only (avoid OS scaling for this pass). If any control is invisible or focus is lost, file a regression before release.

## SSO and entitlement (happy path)

1. Log into Bookiji at `https://bookiji.com` (or your production URL).
2. Open a new tab and go to `https://kinetix.bookiji.com`.
3. **Confirm:** No login screen; app loads (e.g. Run Dashboard or first protected route).
4. **Confirm:** Profile/identity is present and entitlement check passes (e.g. Coach, History, Settings are accessible).

## Entitlement gating (remove entitlement)

1. In the database, remove the `kinetix` entitlement for the test user (e.g. delete or deactivate the row in `platform.entitlements` for that user and product_key `kinetix`).
2. Refresh `https://kinetix.bookiji.com` (or open it again in a new tab while still logged in).
3. **Confirm:** App redirects or shows the **Entitlement required** page (no access to protected routes).

This confirms that:
- Auth state is shared (or at least valid on kinetix subdomain).
- Entitlement check runs and blocks access when the kinetix entitlement is missing.

## Optional: login from kinetix subdomain

1. Log out from Bookiji/Kinetix.
2. Open `https://kinetix.bookiji.com` and sign in with email magic link (or configured OAuth provider).
3. **Confirm:** Redirect back to kinetix.bookiji.com and app loads with profile and entitlement.

If this fails, check Supabase Auth redirect URLs include `https://kinetix.bookiji.com` and `https://kinetix.bookiji.com/**`.

## Supabase Auth (shared Bookiji project)

In **Authentication** → **Providers**: email magic link / OTP on; email+password and password recovery off. Enable Google, Apple, or Azure (Microsoft) only when credentials exist. In **URL Configuration**, allow the Kinetix origin and `/**` patterns (see [ENV_PARITY.md](./ENV_PARITY.md)).
