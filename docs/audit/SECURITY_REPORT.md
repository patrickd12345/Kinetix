# Security report

## Authentication & authorization (web)

| Control | Implementation | Notes |
|---------|------------------|--------|
| Session | Supabase Auth (`AuthProvider`) | Normal path |
| Platform profile | `fetchPlatformProfile` → `platform.profiles` | Required for app shell |
| Entitlement | `hasActiveEntitlementForUser` → `platform.entitlements` | Blocks `forbidden` → `EntitlementRequired` |
| Dev bypass | `VITE_SKIP_AUTH` | **Never enable in production** — mock session + profile |
| Audit bypass | `VITE_MASTER_ACCESS` + `MASTER_ACCESS` in `platformAuth` / `featureFlags` | **Never enable in production** — forces entitled + all flags |

## API (Vercel)

| Area | Control | Risk if misconfigured |
|------|---------|------------------------|
| Support queue | `requireSupportOperator` + JWT validation + allowlist `KINETIX_SUPPORT_OPERATOR_USER_IDS` | Ticket data exposure |
| Audit bypass | `KINETIX_MASTER_ACCESS` accepts bypass token matching Vite skip-auth session | **Critical** if set in prod |
| CORS | `applyCors` in support-queue handler | Origin allowlist must match app |
| Billing | Stripe secret server-side only | Key leakage = financial risk |
| Strava/Withings | OAuth secrets, proxy patterns | Token theft |

## Removed in this audit

- **Debug telemetry:** Removed localhost `fetch` calls to `127.0.0.1:7789` from `AuthProvider.tsx` (would leak behavior in browser and fail silently in production).

## Headers (`vercel.json`)

- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection` — baseline; modern apps also rely on CSP (not verified here).

## Recommendations

1. **Confirm** `VITE_SKIP_AUTH`, `VITE_MASTER_ACCESS`, and `KINETIX_MASTER_ACCESS` are **unset/false** in Vercel production.
2. Add **CSP** and Subresource Integrity where applicable.
3. Periodic **dependency audit** (`pnpm audit`) — not run in this pass.
