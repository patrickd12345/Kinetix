# Status page setup (Lane D)

Goal: a public page Kinetix users can check during outages, with a banner channel from on-call engineering.

## Recommendation

Use a managed status page; do not roll our own:

- **Recommended:** [Statuspage.io](https://www.atlassian.com/software/statuspage) (Atlassian) - $$ but excellent integrations.
- **Free option:** [GitHub status page repo](https://github.com/cstate/cstate) hosted on GitHub Pages - free but more manual.
- **Vercel ecosystem option:** [openstatus.dev](https://openstatus.dev) - open source, self-host or hosted.

## Required components

1. **Domain:** `status.bookiji.com` (CNAME to status provider). Single page covers Bookiji + Kinetix.
2. **Component groups:**
   - Web (Kinetix)
   - Web (Bookiji)
   - API - Stripe billing
   - API - AI chat
   - API - Garmin sync (when live)
   - Auth - Bookiji-first SSO
3. **Automated probes:** every 60s, GET probes against the same URLs as `scripts/phase4/post-deploy-probes.mjs`. Provider-managed.
4. **Manual update flow:** on-call engineer opens incident with severity + affected components + initial message; then status moves through `Investigating -> Identified -> Monitoring -> Resolved`.

## Pre-launch tasks (operator)

- [ ] Choose provider; create org account.
- [ ] Add `status.bookiji.com` domain in DNS (CNAME to provider).
- [ ] Create the component groups above.
- [ ] Add automated probes for the 5 URLs in `post-deploy-probes.mjs` plus `/api/auth/health-check` on Bookiji.
- [ ] Subscribe `#kinetix-incidents` Slack to status page webhooks.
- [ ] Add status page link to:
  - Help Center footer (Kinetix `/help`)
  - Marketing landing page footer
  - Support email auto-reply

## Banner integration (later)

Optionally add a thin banner component to Kinetix that fetches `https://status.bookiji.com/api/v2/status.json` (Statuspage format) and shows a one-line warning when `status.indicator !== 'none'`. Skip for v1; add in the first post-launch cycle if helpful.

## Security note

Status page should be public, but DO NOT expose internal probe responses, deployment ids, or environment names. The page must say "Web", not "production deployment dpl_xxx".
