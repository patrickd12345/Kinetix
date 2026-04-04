# Kinetix deployment and platform integration

Index for **identity (SSO)**, **secrets (Infisical)**, **billing (Stripe subscription + entitlements)**, and verification. For workspace-wide rules that apply to **future apps**, see **[`docs/platform/APP_INTEGRATION_STANDARD.md`](../../../../docs/platform/APP_INTEGRATION_STANDARD.md)** and **[`SPINE_CONTRACT.md`](../../../../SPINE_CONTRACT.md)** at the umbrella root.

---

## Quick map

| Topic | Document |
| ----- | -------- |
| SSO / same Supabase as Bookiji | [ENV_PARITY.md](./ENV_PARITY.md) |
| Admlog (`GET /api/admlog`) — dev/preview only | [ENV_PARITY.md](./ENV_PARITY.md#admlog-get-apiadmlog) |
| Infisical paths, merge order, `pnpm dev:infisical`, `pnpm verify:infisical` | [INFISICAL_LOCAL_DEV.md](./INFISICAL_LOCAL_DEV.md) |
| Checkout session API, Bookiji webhook, `platform.entitlements` | [STRIPE_KINETIX_ENTITLEMENTS.md](./STRIPE_KINETIX_ENTITLEMENTS.md) |
| Subdomain and DNS | [KINETIX_SUBDOMAIN.md](./KINETIX_SUBDOMAIN.md) |
| Manual go-live checks | [KINETIX_VERIFICATION_CHECKLIST.md](./KINETIX_VERIFICATION_CHECKLIST.md) |
| Optional umbrella memory bridge (governance; default off) | [MEMORY_BRIDGE_CONTRACT.md](../../../../docs/platform/MEMORY_BRIDGE_CONTRACT.md) — *Kinetix operator notes* |

---

## One-line mental model

1. **Identity:** Supabase Auth + **`platform.profiles`** (same project as Bookiji for SSO).
2. **Access:** **`platform.entitlements`** with `product_key = 'kinetix'` (see [`apps/web/src/lib/platformAuth.ts`](../../apps/web/src/lib/platformAuth.ts)).
3. **Secrets:** Infisical **`/platform`** + **`/kinetix`**, merged with Kinetix overrides; validate with `pnpm verify:infisical` from the Kinetix repo root.
4. **Payments:** `POST /api/billing/create-checkout-session` on Kinetix (server); **Bookiji** `POST /api/payments/webhook` writes `platform.entitlements` — see [STRIPE_KINETIX_ENTITLEMENTS.md](./STRIPE_KINETIX_ENTITLEMENTS.md). No Stripe secrets in the web bundle.
