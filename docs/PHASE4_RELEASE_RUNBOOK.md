# Phase 4 - Web release runbook (Lane A8)

Goal: cut a release tag, promote the corresponding Vercel deployment to production, and validate the result without surprise.

> Pre-condition: every row in [`PHASE4_RELEASE_EVIDENCE.md`](PHASE4_RELEASE_EVIDENCE.md) "Operator action queue" is PASS, and Lane B (native) is at TestFlight or beyond. If either is not true, do not proceed.

## 1. Tag cut

```powershell
# from products/Kinetix on a clean main
git fetch origin
git checkout main
git pull --ff-only

# describe the release in CHANGELOG.md (if you keep one) or PHASE4_RELEASE_EVIDENCE.md.
# tag from the commit you actually intend to ship.
$tag = "v1.0.0"  # bump per semver; pre-release tags acceptable: v1.0.0-rc.1
git tag -a $tag -m "Kinetix public launch ($tag)"
git push origin $tag
```

The tag triggers GitHub Actions (`web-ci.yml` + `web-e2e.yml`). Both must be green before promoting Vercel.

## 2. Promote on Vercel

1. Open the Vercel dashboard for the **kinetix** project.
2. Find the deployment built from the tagged commit (Inspector URL).
3. Confirm: build status `Ready`, `vercel-parity` workflow `success`, `Web E2E` workflow `success`.
4. Click `Promote to Production` (or use `vercel promote <deployment_url> --scope <team>`).
5. Verify the production alias `kinetix.bookiji.com` now points to the new deployment id (Domains tab).

## 3. Post-deploy probes (scripted)

```powershell
node scripts/phase4/post-deploy-probes.mjs --host https://kinetix.bookiji.com
```

Expect: PASS row. Paste the markdown row into [`PHASE4_RELEASE_EVIDENCE.md`](PHASE4_RELEASE_EVIDENCE.md) under a new "Post-deploy probes (<tag>)" section.

## 4. Live billing smoke

Pre-condition: `BILLING_ENABLED=true` and live Stripe keys are set in Vercel production for both Kinetix and Bookiji projects (per [`deployment/STRIPE_KINETIX_ENTITLEMENTS.md`](deployment/STRIPE_KINETIX_ENTITLEMENTS.md) "Live cutover order").

```powershell
infisical run --env=prod --path=/platform -- node scripts/phase4/verify-stripe-live.mjs
```

Then complete one production checkout end-to-end and confirm a real `platform.entitlements` row was created. Record evidence.

## 5. Rollback (if needed)

If post-deploy probes FAIL or live billing smoke fails:

1. On Vercel, promote the previous production deployment id (Inspector -> "Promote to Production").
2. If the cause is environment-only (e.g. wrong env var), fix env on Vercel + Infisical, then re-promote the same build.
3. If the cause is a code regression, revert the tag locally:

```powershell
git tag -d $tag
git push --delete origin $tag
git revert <bad_commit>
```

Open a defect-fix branch, re-cut a new tag (`v1.0.1`), repeat steps 1-4.

## 6. Comms

After post-deploy probes are PASS and live billing smoke is PASS:

- Post in `#launch-kinetix` (or equivalent) with the deployment id, tag, and evidence-row link.
- Update [`PROJECT_PLAN.md`](PROJECT_PLAN.md) and umbrella `PROJECT_PLAN.md` "Current focus" cells.
- Trigger the Lane D items (status page, GA comms) per [`docs/PHASE4_LAUNCH_COMMS.md`](PHASE4_LAUNCH_COMMS.md) when written.
