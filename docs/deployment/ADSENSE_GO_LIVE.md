# Kinetix — AdSense + web MVP go-live

**Standard:** umbrella [`docs/standards/ADSENSE_STANDARD.md`](../../../../docs/standards/ADSENSE_STANDARD.md).  
**Web MVP (beta):** compliance routes, footer, cookie banner, env readiness, beta full-access flags — shipped on branch `kx-mvp-beta-fasttrack` (merge to `main` before production cut).

## Already in repo

- [`apps/web/public/ads.txt`](../../apps/web/public/ads.txt) — `google.com, pub-…, DIRECT, …` (must match Infisical + Vercel `VITE_ADSENSE_CLIENT`).
- Compliance: `/privacy`, `/terms`, `/contact`; [`Footer`](../../apps/web/src/components/Footer.tsx); [`CookieBanner`](../../apps/web/src/components/CookieBanner.tsx).
- Client: [`apps/web/src/lib/adsense.ts`](../../apps/web/src/lib/adsense.ts), [`AdSenseScript`](../../apps/web/src/components/ads/AdSenseScript.tsx), [`AdSenseDisplayUnit`](../../apps/web/src/components/ads/AdSenseDisplayUnit.tsx), optional [`AdSlot`](../../apps/web/src/components/ads/AdSlot.tsx) placeholder.
- **Vercel [`vercel.json`](../../vercel.json):** SPA rewrite **does not** send `ads.txt`, `robots.txt`, or `sitemap.xml` to `index.html`. Global CSP includes Standard 10 AdSense hosts (`script-src` / `connect-src` / `frame-src`).
- **Infisical:** `VITE_ADSENSE_CLIENT` in **`/kinetix`** for `dev` and `prod` — see [`ENV_PARITY.md`](./ENV_PARITY.md).

## Build verification (local)

From `products/Kinetix`:

```bash
pnpm lint && pnpm type-check && pnpm --filter @kinetix/web exec vitest run
pnpm --filter @kinetix/web build
```

Confirm `apps/web/dist/ads.txt` exists and still contains the `google.com, pub-…` line (Vite copies `public/`).

Optional parity (install + build like CI): `pnpm verify:kinetix-parity` from repo root.

## Operator checklist (production)

1. **Merge** `kx-mvp-beta-fasttrack` → `main` (or open PR, review, merge).
2. **Infisical** `prod` `/kinetix`: `VITE_ADSENSE_CLIENT` present; optional `VITE_ADSENSE_SLOT` when the display unit is created; do **not** set `VITE_ADSENSE_GLOBAL_OFF=true` for live ads.
3. **Vercel** `kinetix` project: Production env has `VITE_ADSENSE_CLIENT` (manual or Infisical → Vercel sync). Redeploy after merge.
4. **After deploy:** `curl -sS https://<production-origin>/ads.txt` — must return **plain text** with the seller line, **not** HTML.
5. **AdSense console:** Add site URL, confirm ads.txt status **Found**, complete site review.

## Deferred

- **`VITE_ADSENSE_SLOT`** until a display ad unit exists in AdSense (needed for [`AdSenseDisplayUnit`](../../apps/web/src/components/ads/AdSenseDisplayUnit.tsx) to render a real unit).
- **Personalized ads** — ensure Privacy copy and consent banner match any personalization claim (legal review).
