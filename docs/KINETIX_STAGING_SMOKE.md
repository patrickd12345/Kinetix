# Kinetix Staging Smoke Test

This document outlines the requirements and manual steps to verify the Kinetix staging deployment prior to production release.

## Prerequisites & Environment Variables

Ensure the staging environment includes the following core environment variables (with staging-specific values):

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (must match the staging Supabase project)
- `SUPABASE_SECRET_KEY` (staging project service role key, required for backend routes)
- `GEMINI_API_KEY` (or configured AI provider for coaching and support AI)

### Feature Toggles (if applicable)
- **Billing:** If billing is enabled on staging, `BILLING_ENABLED=true`, `STRIPE_SECRET_KEY`, and `KINETIX_STRIPE_PRICE_ID` must be configured.

## Verification Checklist

1. **Authentication Requirement:**
   - [ ] Confirm `VITE_SKIP_AUTH` is disabled or ignored. You must be prompted for a real sign-in (e.g., Magic Link, Google, etc.).
   - [ ] Complete the sign-in process and verify a successful redirect to the dashboard.

2. **Supabase & Entitlement Requirement:**
   - [ ] Confirm your signed-in staging user has a `kinetix` entitlement in the staging `platform.entitlements` table.
   - [ ] Verify you can access the main dashboard.
   - [ ] Remove the entitlement from your test user in the staging DB and refresh the page. Confirm you are correctly redirected to the **Entitlement required** page. Re-add the entitlement for further testing.

3. **Dashboard / History / KPS Smoke:**
   - [ ] Ensure the KPS score correctly renders on the Run Dashboard.
   - [ ] Navigate to the History page. Ensure historical runs and synced runs load correctly without error.
   - [ ] Test uploading or syncing a run manually if the environment supports it, and verify that KPS updates accordingly.

4. **Support & Help Center Smoke:**
   - [ ] Navigate to the Help Center.
   - [ ] Interact with the Support AI/KB search. Ensure the search query works and returns an AI or KB response.
   - [ ] (If testing operator escalation) Verify an escalation ticket can be filed and successfully created.

5. **Billing & Stripe (if enabled):**
   - [ ] Attempt to access a premium feature or checkout flow and verify the redirect to the Stripe staging checkout occurs successfully.
   - [ ] If applicable, test the success/cancel return routes (`/billing/success`, `/billing/cancel`).

## Rollback Procedure

If the staging deployment fails critically (e.g., white screen, failed build, database connection errors that are not misconfiguration), note the failure, do not proceed with the release candidate tag, and revert the staging deployment to the previous known good commit.

## Sign-off

- [ ] All required environment variables are set and verified.
- [ ] Real auth works perfectly.
- [ ] Entitlements properly gate the application.
- [ ] Dashboard, KPS, and history function correctly.
- [ ] Support Center functions without errors.
- [ ] (If enabled) Billing works with staging keys.

*Once all items are checked, the staging deployment is considered passing.*