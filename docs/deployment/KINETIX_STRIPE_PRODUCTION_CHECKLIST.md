# Kinetix Stripe production checklist (subscriptions + entitlements)

Keep Kinetix and Bookiji on the **same Stripe account** (test vs live). Webhooks are only handled by **Bookiji**.

## Required env vars

**Kinetix (Vercel / api):**
- `BILLING_ENABLED=true`
- `STRIPE_SECRET_KEY` (same account as Bookiji)
- `KINETIX_STRIPE_PRICE_ID`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (must point to Bookiji Supabase project)
- `CORS_ALLOWED_ORIGINS` (optional tighten)

**Bookiji (webhook):**
- `BILLING_ENABLED=true`
- `STRIPE_SECRET_KEY` (same as above)
- `STRIPE_WEBHOOK_SECRET` (from Stripe endpoint)
- `SUPABASE_SERVICE_ROLE_KEY` / db creds

## Webhook endpoint registration (Stripe Dashboard)
- Endpoint URL: `<bookiji-host>/api/payments/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` (and booking events already present)
- Remove/disable any legacy endpoints (`/api/stripe/webhook`, `/api/webhooks/stripe`).

## End-to-end test (test mode)
1) Start Bookiji locally (`pnpm dev`, port 3000) with Stripe test keys and `BILLING_ENABLED=true`.
2) Start Stripe CLI forwarding: `stripe listen --forward-to localhost:3000/api/payments/webhook` and set the printed `STRIPE_WEBHOOK_SECRET` for Bookiji.
3) Run Kinetix locally (`vercel dev --listen 3001`) with matching Supabase creds, `STRIPE_SECRET_KEY`, `KINETIX_STRIPE_PRICE_ID`, `BILLING_ENABLED=true`.
4) Create checkout: `curl -X POST http://localhost:3001/api/billing/create-checkout-session -H "Authorization: Bearer <supabase access token>" -H "Content-Type: application/json" -d '{"successUrl":"http://localhost:3001/billing/success","cancelUrl":"http://localhost:3001/billing/cancel"}'`.
5) Complete hosted checkout with `4242 4242 4242 4242`.
6) Expect:
   - Stripe CLI shows `checkout.session.completed` and subscription events.
   - Bookiji `platform.entitlements` row for `product_key=kinetix`, `active=true`, metadata contains `stripe_subscription_id`.
   - Kinetix web gates correctly (entitlement present/absent).

## Rollback if entitlements fail
- Disable billing quickly by setting `BILLING_ENABLED=false` (both apps) and redeploy; checkout route/webhook will return 503.
- Cancel affected Stripe subscriptions (dashboard or API) to stop renewals.
- Manually correct `platform.entitlements` (set `active=false` or delete) for impacted users via Supabase service role.
- Re-run the end-to-end test above after fixes, then re-enable billing.
