# Kinetix deployment and platform integration

Index for **identity (SSO)**, **secrets (Infisical)**, **billing (entitlements / future Stripe)**, and verification. For workspace-wide rules that apply to **future apps**, see **[`docs/platform/APP_INTEGRATION_STANDARD.md`](../../../../docs/platform/APP_INTEGRATION_STANDARD.md)** and **[`SPINE_CONTRACT.md`](../../../../SPINE_CONTRACT.md)** at the umbrella root.

---

## Quick map

| Topic | Document |
| ----- | -------- |
| SSO / same Supabase as Bookiji | [ENV_PARITY.md](./ENV_PARITY.md) |
| Infisical paths, merge order, `pnpm dev:infisical`, `pnpm verify:infisical` | [INFISICAL_LOCAL_DEV.md](./INFISICAL_LOCAL_DEV.md) |
| Entitlements today; Stripe design for Kinetix Pro later | [STRIPE_KINETIX_ENTITLEMENTS.md](./STRIPE_KINETIX_ENTITLEMENTS.md) |
| Subdomain and DNS | [KINETIX_SUBDOMAIN.md](./KINETIX_SUBDOMAIN.md) |
| Manual go-live checks | [KINETIX_VERIFICATION_CHECKLIST.md](./KINETIX_VERIFICATION_CHECKLIST.md) |

---

## One-line mental model

1. **Identity:** Supabase Auth + **`platform.profiles`** (same project as Bookiji for SSO).
2. **Access:** **`platform.entitlements`** with `product_key = 'kinetix'` (see [`apps/web/src/lib/platformAuth.ts`](../../apps/web/src/lib/platformAuth.ts)).
3. **Secrets:** Infisical **`/platform`** + **`/kinetix`**, merged with Kinetix overrides; validate with `pnpm verify:infisical` from the Kinetix repo root.
4. **Payments:** No Stripe in the Kinetix web bundle yet; future flow extends Bookiji Stripe webhooks into entitlements (see STRIPE doc).
