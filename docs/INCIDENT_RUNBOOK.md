# Kinetix incident runbook (Lane D)

Audience: on-call engineer for Kinetix web + mobile.

## Severity ladder

| Severity | Definition | Response time |
|----------|------------|---------------|
| **SEV-1** | Production unavailable for >50% of users; billing broken; data loss | Acknowledge in 5 min, fix or rollback in 30 min |
| **SEV-2** | Major flow broken (login, checkout, AI chat, sync) for some users; degraded perf | Acknowledge in 15 min, fix or workaround in 2 h |
| **SEV-3** | Minor flow broken or single-user issue | Acknowledge in 1 business day |
| **SEV-4** | Cosmetic, docs, or low-impact bug | Backlog |

## On-call channels

- Pager: PagerDuty service `kinetix-prod` (configure live before launch).
- Triage Slack: `#kinetix-incidents` (private; subscribe before launch).
- Status page: <https://status.bookiji.com> (path TBD - see [`STATUS_PAGE_SETUP.md`](STATUS_PAGE_SETUP.md)).

## First 10 minutes (any SEV-1 / SEV-2)

1. **Acknowledge** in PagerDuty.
2. **Open `#kinetix-incidents`** with: who you are, what page/flow, what evidence (URL, deployment id, error code).
3. **Look at signals** in priority order:
   - Vercel deployment status: <https://vercel.com/patrick-duchesneaus-projects/kinetix>
   - Supabase status: project dashboard -> Database / Auth / Storage tabs
   - Stripe status: <https://status.stripe.com>
   - Sentry / error budget (if Sentry SDK is live - see [`apps/web` Sentry config when added]).
4. **Run scripted probes:** `node scripts/phase4/post-deploy-probes.mjs --host https://kinetix.bookiji.com`.
5. **Decide:** rollback vs forward fix. Default for SEV-1 is **rollback** while you investigate.

## Rollback (Vercel)

1. Vercel -> kinetix project -> Deployments -> previous green production deployment.
2. "Promote to Production" -> wait for alias to update (`kinetix.bookiji.com`).
3. Re-run probes.
4. If rollback removes the bug, file a defect-fix ticket; do not "fix forward" without sign-off.

## Common failure classes

### Login fails (Bookiji-first SSO)

- Likely: Supabase URL allowlist drift, Google OAuth credentials expired, or `/api/auth/health-check` Bookiji webhook regression.
- Diagnose: open `https://app.bookiji.com/api/auth/health-check`; expect `{"ok":true,"status":200}`.
- Diagnose: open Supabase -> Authentication -> URL Configuration; confirm Kinetix origins are listed.
- Mitigation: rollback Bookiji or fix Supabase URL config; status page banner.

### Entitlement check fails (Kinetix shows "Entitlement required")

- Likely: Stripe webhook on Bookiji failed to write to `platform.entitlements`, or Bookiji ran behind on subscription events.
- Diagnose: query `platform.entitlements` for the user (Supabase SQL). Look for `active=true` row.
- Diagnose: check Bookiji webhook logs for `checkout.session.completed` failures.
- Mitigation: re-deliver event from Stripe Dashboard; or use [`apps/web/scripts/seed-kinetix-entitlement-admin.ts`](../apps/web/scripts/seed-kinetix-entitlement-admin.ts) for affected user as a temporary unblock; status page banner if widespread.

### AI chat 5xx

- Likely: AI provider outage or `monorepo-packages/ai-runtime` regression.
- Diagnose: Vercel logs for `/api/ai-chat`; look for upstream provider errors.
- Mitigation: provider-specific (OpenAI/Anthropic outage -> wait + status banner). If regression, rollback.

### Garmin OAuth fails

- Likely: missing `GARMIN_CONNECT_CLIENT_SECRET` (pre-approval), or Garmin API outage post-approval.
- Diagnose: `/api/garmin-oauth` server logs; expected 503 if env missing, upstream error otherwise.
- Mitigation: confirm Vercel + Infisical env; banner on Settings if Garmin API outage.

### Stripe checkout returns 503

- Likely: `BILLING_ENABLED` is off, or `STRIPE_SECRET_KEY` / `KINETIX_STRIPE_PRICE_ID` missing on Vercel for kinetix project.
- Diagnose: Vercel project env tab; run `node scripts/phase4/verify-stripe-live.mjs` from a machine with Infisical.
- Mitigation: fix env, redeploy (env-only redeploy is safe and fast).

## After-action

1. Within 24 h, write a brief postmortem (template: blameless, root cause + 5 whys + remediation).
2. Add a row to [`PHASE4_RELEASE_EVIDENCE.md`](PHASE4_RELEASE_EVIDENCE.md) under "Incidents".
3. File remediation tickets and add them to [`RISK_REGISTER.md`](../RISK_REGISTER.md) when the cause is structural.
