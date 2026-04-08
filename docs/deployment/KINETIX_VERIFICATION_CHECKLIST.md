# kinetix.bookiji.com manual verification checklist

Run this after DNS, Supabase redirect URLs, and Kinetix env parity are in place.

## Admlog (production must stay disabled)

1. On **production** `kinetix.bookiji.com`, open `GET /api/admlog` (or use curl). **Confirm:** HTTP **403** and a response that does **not** instruct you to enable `ADMLOG_ENABLED` for production.
2. From the repo (with Infisical CLI): `node scripts/verify-infisical.mjs --env=prod` **Confirm:** exits **0** and does not flag `ADMLOG_ENABLED` in prod (see [ENV_PARITY.md](./ENV_PARITY.md#admlog-get-apiadmlog)).

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
