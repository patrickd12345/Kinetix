-- Idempotency table for Stripe webhooks: one row per event_id.
-- Unique constraint on event_id makes INSERT the serialization point (claim-before-process).
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  event_id TEXT NOT NULL PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.processed_webhook_events IS 'Stripe webhook idempotency; insert ON CONFLICT DO NOTHING used to claim event processing.';
