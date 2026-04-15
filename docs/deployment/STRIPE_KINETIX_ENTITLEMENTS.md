# Stripe and Kinetix entitlements (implemented)

Workspace standard (identity, payment, Infisical): **[`docs/platform/APP_INTEGRATION_STANDARD.md`](../../../../docs/platform/APP_INTEGRATION_STANDARD.md)**.

## Identity prerequisite

Kinetix web uses the **same Supabase project** as Bookiji for SSO ([`ENV_PARITY.md`](./ENV_PARITY.md)). Entitlements are keyed to **`auth.users`** / **`platform.profiles`**. Checkout sessions always set **`metadata.user_id`** to the authenticated Supabase user id before Stripe sees the request.

## What is implemented

### 1. Kinetix: create Checkout Session (subscription)

- **Route:** `POST /api/billing/create-checkout-session` (Vercel serverless under [`api/billing/create-checkout-session`](../../api/billing/create-checkout-session/index.ts)).
- **Auth:** `Authorization: Bearer <Supabase access token>` (same session as the web app).
- **Body:** JSON `{ "successUrl": "...", "cancelUrl": "...", "entitlementKey": "default" }` (entitlement key optional; defaults to `default`).
- **Stripe:** Uses shared helper [`createKinetixSubscriptionCheckoutSession`](../../../../packages/stripe-runtime/src/kinetixCheckoutSession.ts) from **`@bookiji-inc/stripe-runtime`**: subscription mode, `metadata` and `subscription_data.metadata` include `product_key=kinetix`, `user_id`, and `entitlement_key`.
- **Env validation:** `BILLING_ENABLED=true`, `STRIPE_SECRET_KEY`, and `KINETIX_STRIPE_PRICE_ID` must be set or the route returns **503** with a clear message (see [`api/_lib/kinetixStripe.ts`](../../api/_lib/kinetixStripe.ts)).

### 2. Bookiji: canonical webhook (single path)

- **Endpoint:** `POST /api/payments/webhook` only (see [`STRIPE_WEBHOOK_CANONICAL.md`](../../../bookiji/docs/backend/STRIPE_WEBHOOK_CANONICAL.md)).
- **Handler:** [`paymentsWebhookHandler.ts`](../../../bookiji/src/lib/paymentsWebhookHandler.ts) — same **claim-by-insert** idempotency on `bookiji.stripe_event_log` as booking payments.
- **Events handled for Kinetix:**
  - `checkout.session.completed` — grants or refreshes entitlement when `metadata.product_key` is `kinetix` and subscription status is active/trialing ([`StripeService.handleKinetixCheckoutSessionCompleted`](../../../bookiji/src/lib/services/stripe.ts)).
  - `customer.subscription.updated` / `customer.subscription.deleted` — sets `platform.entitlements.active` from subscription status (`active`/`trialing` vs all other terminal states) ([`StripeService.handleKinetixSubscriptionEvent`](../../../bookiji/src/lib/services/stripe.ts)).
- **Database:** `platform.entitlements` upsert on `(user_id, product_key, entitlement_key)` with `product_key = 'kinetix'`, `source = 'stripe'`.

### 3. Web app gating (unchanged)

Access is still enforced by reading **`platform.entitlements`** for `product_key = 'kinetix'` ([`apps/web/src/lib/platformAuth.ts`](../../apps/web/src/lib/platformAuth.ts)). No Stripe keys in the browser bundle.

```mermaid
sequenceDiagram
  participant User
  participant KinetixWeb as Kinetix web
  participant KinetixAPI as Kinetix POST /api/billing/create-checkout-session
  participant Stripe as Stripe
  participant BookijiWH as Bookiji POST /api/payments/webhook
  participant DB as platform.entitlements

  User->>KinetixWeb: Signed in
  KinetixWeb->>KinetixAPI: Bearer JWT + success/cancel URLs
  KinetixAPI->>Stripe: Checkout Session (subscription, metadata)
  Stripe-->>User: Hosted checkout
  Stripe->>BookijiWH: checkout.session.completed / subscription events
  BookijiWH->>DB: upsert kinetix entitlement
  KinetixWeb->>DB: read entitlement (client via Supabase)
```

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `BILLING_ENABLED` | Kinetix Vercel + Bookiji | Must be `true` for checkout route and webhook handler gate |
| `STRIPE_SECRET_KEY` | Kinetix Vercel (checkout) + Bookiji (webhook) | Same Stripe account in test/live |
| `STRIPE_WEBHOOK_SECRET` | Bookiji only | Verifies webhook signatures |
| `KINETIX_STRIPE_PRICE_ID` | Kinetix Vercel | Subscription **Price** id (`price_...`) for Kinetix |

Store secrets in Infisical per [`INFISICAL_LOCAL_DEV.md`](./INFISICAL_LOCAL_DEV.md) and deploy envs.

## Stripe Dashboard configuration

1. Use **one** Stripe account for test (or live) across Kinetix checkout and Bookiji webhook.
2. **Webhooks:** endpoint URL = your Bookiji origin + `/api/payments/webhook` (e.g. `https://www.bookiji.com/api/payments/webhook`).
3. Subscribe at minimum to: **`checkout.session.completed`**, **`customer.subscription.updated`**, **`customer.subscription.deleted`** (plus existing booking events if needed).

## Local testing (Stripe test mode)

Prereqs: Bookiji dev server on port **3000**, Kinetix available via **`vercel dev`** in the Kinetix repo (serves `/api/*` and the web app), test keys in env.

1. **Terminal A — Bookiji:** from `products/bookiji`, run the Next dev server (e.g. `pnpm dev`).
2. **Terminal B — Stripe CLI:** forward webhooks to Bookiji:

   ```bash
   stripe listen --forward-to localhost:3000/api/payments/webhook
   ```

   Copy the **webhook signing secret** the CLI prints and set `STRIPE_WEBHOOK_SECRET` for Bookiji (or use `.env.local`).

3. **Terminal C — Kinetix:** from `products/Kinetix`, run `vercel dev --listen 3001` (avoids clashing with Bookiji on `:3000`). Set `BILLING_ENABLED=true`, `STRIPE_SECRET_KEY` (test key), `KINETIX_STRIPE_PRICE_ID` (test **Price**), and Supabase vars consistent with [`ENV_PARITY.md`](./ENV_PARITY.md).

4. Call checkout from the Kinetix origin (or tool):

   ```bash
   KINETIX_ORIGIN="http://localhost:3001"
   curl -sS -X POST "${KINETIX_ORIGIN}/api/billing/create-checkout-session" \
     -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d "{\"successUrl\":\"${KINETIX_ORIGIN}/billing/success\",\"cancelUrl\":\"${KINETIX_ORIGIN}/billing/cancel\"}"
   ```

   Use the returned `url` in a browser, complete test card **4242 4242 4242 4242**. Confirm `checkout.session.completed` in the `stripe listen` output and a row in `platform.entitlements` for `product_key = kinetix`.

5. **Revocation:** cancel the subscription in [Stripe Dashboard](https://dashboard.stripe.com) (test mode) or via API; expect `customer.subscription.deleted` and `active = false` on the entitlement row.

## Manual access without Stripe

For QA without a card flow, use [`apps/web/scripts/seed-kinetix-entitlement-admin.ts`](../../apps/web/scripts/seed-kinetix-entitlement-admin.ts) or a controlled migration against `platform.entitlements`.

## Related docs

- [`docs/platform/APP_INTEGRATION_STANDARD.md`](../../../../docs/platform/APP_INTEGRATION_STANDARD.md)
- [`ENV_PARITY.md`](./ENV_PARITY.md)
- [`INFISICAL_LOCAL_DEV.md`](./INFISICAL_LOCAL_DEV.md)
- [`products/bookiji/docs/backend/STRIPE_WEBHOOK_CANONICAL.md`](../../../bookiji/docs/backend/STRIPE_WEBHOOK_CANONICAL.md)
