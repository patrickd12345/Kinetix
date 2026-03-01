-- Partner API v1: reservations table for core-infrastructure reservation service.
-- Stores soft-hold reservations with idempotency and state.

CREATE TABLE IF NOT EXISTS public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id TEXT NOT NULL,
  vendor_id UUID NOT NULL,
  requester_id TEXT NOT NULL,
  slot_start_time TIMESTAMPTZ NOT NULL,
  slot_end_time TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL DEFAULT 'INTENT_CREATED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ttl_stage TEXT DEFAULT 'initial',
  ttl_minutes INTEGER NOT NULL DEFAULT 10,
  metadata JSONB,
  idempotency_key TEXT,
  UNIQUE (partner_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_reservations_partner_id ON public.reservations (partner_id);
CREATE INDEX IF NOT EXISTS idx_reservations_vendor_id ON public.reservations (vendor_id);
CREATE INDEX IF NOT EXISTS idx_reservations_expires_at ON public.reservations (expires_at);
COMMENT ON TABLE public.reservations IS 'Partner API v1 soft-hold reservations; used by reservationService.';
