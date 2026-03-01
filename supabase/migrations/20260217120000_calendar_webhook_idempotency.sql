-- Idempotency table for calendar webhooks (Google/Microsoft): claim-by-insert.
-- Insert (connection_id, dedupe_key) first; on unique violation treat as already processed.
CREATE TABLE IF NOT EXISTS public.processed_calendar_webhooks (
  connection_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (connection_id, dedupe_key)
);
COMMENT ON TABLE public.processed_calendar_webhooks IS 'Calendar webhook idempotency; insert before processing, on 23505 return 200.';
