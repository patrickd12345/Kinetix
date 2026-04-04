# Stripe and Kinetix entitlements (design for future billing)

Kinetix does not ship a Stripe SDK or checkout UI today. Access is enforced in the web app by reading **`platform.entitlements`** for `product_key = 'kinetix'` (see [`apps/web/src/lib/platformAuth.ts`](../../apps/web/src/lib/platformAuth.ts)).

Bookiji’s existing Stripe webhook path ([`products/bookiji/src/lib/services/stripe.ts`](../../../bookiji/src/lib/services/stripe.ts)) upserts **`product_key: 'bookiji'`** for vendor subscriptions only. That flow does **not** grant Kinetix.

## Target end state (when card checkout is required)

1. **Stripe Dashboard** — Create a Product (e.g. “Kinetix Pro”) and Price(s). Store price id(s) in Infisical under `/kinetix` or `/bookiji` per inventory in [`ops/env/env-inventory.md`](../../../../ops/env/env-inventory.md).
2. **Checkout** — Either:
   - **A.** Add a small checkout entry point on **bookiji.com** (or a shared billing page) that creates a Checkout Session with `metadata.product_key=kinetix` and `metadata.user_id=<auth uid>`, or
   - **B.** Add a **Kinetix** server route (new backend surface) that calls Stripe Checkout with the same metadata (requires adding Stripe to the Kinetix deployment and secrets).
3. **Webhook** — Extend the **canonical** Bookiji payments webhook handler (same idempotency and `processed_webhook_events` patterns as existing flows) so that on `checkout.session.completed` (or `customer.subscription.*` if using subscriptions), when metadata indicates Kinetix, perform:

   ```text
   upsert platform.entitlements
   user_id = <customer user id>
   product_key = 'kinetix'
   entitlement_key = <from price or metadata, e.g. 'default'>
   active = true
   source = 'stripe'
   ```

4. **Revocation** — On subscription deleted or payment failed (if subscription-based), set `active = false` for the same `(user_id, product_key, entitlement_key)` row.

5. **Secrets** — `STRIPE_SECRET_KEY`, webhook signing secret, and price ids must live in Infisical and Vercel; never in the client bundle.

## Until this is built

Use [`apps/web/scripts/seed-kinetix-entitlement-admin.ts`](../../apps/web/scripts/seed-kinetix-entitlement-admin.ts) or controlled SQL/migrations against `platform.entitlements` for QA and pilot access.

## Related docs

- [`ENV_PARITY.md`](./ENV_PARITY.md) — Supabase and Vercel parity
- [`INFISICAL_LOCAL_DEV.md`](./INFISICAL_LOCAL_DEV.md) — local secret merge
- [`products/bookiji/docs/backend/STRIPE_WEBHOOK_CANONICAL.md`](../../../bookiji/docs/backend/STRIPE_WEBHOOK_CANONICAL.md) — webhook patterns (Bookiji)
