# Kinetix — AdSense go-live (quick checklist)

**Standard:** umbrella [`docs/standards/ADSENSE_STANDARD.md`](../../../../docs/standards/ADSENSE_STANDARD.md).

## Already in repo

- [`apps/web/public/ads.txt`](../../apps/web/public/ads.txt) — publisher line (must match Infisical / Vercel `VITE_ADSENSE_CLIENT`).
- Compliance: `/privacy`, `/terms`, `/contact`; footer links; cookie banner.
- Client: [`apps/web/src/lib/adsense.ts`](../../apps/web/src/lib/adsense.ts), `AdSenseScript`, optional `AdSenseDisplayUnit`.
- **Vercel:** SPA rewrite excludes `ads.txt`, `robots.txt`, `sitemap.xml` so the static file is not routed to `index.html`. CSP includes AdSense hosts (Standard 10).

## Operator before / after deploy

1. **Infisical `dev` + `prod`** `/kinetix`: `VITE_ADSENSE_CLIENT` set (done). Optional: `VITE_ADSENSE_SLOT` when using the display unit; leave `VITE_ADSENSE_GLOBAL_OFF` unset or `false` for live ads.
2. **Vercel:** Production + Preview + Development envs have `VITE_ADSENSE_CLIENT` (or rely on Infisical sync for Production).
3. **After deploy:** `curl -sS https://kinetix.bookiji.com/ads.txt` — must show the `google.com, pub-…` line, not HTML.
4. **AdSense console:** Site added, ads.txt status “Found”, review complete.

## Deferred

- Slot id until an ad unit exists in AdSense.
- Personalized-ads copy review if enabling personalization beyond defaults.
