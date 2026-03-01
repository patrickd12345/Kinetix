-- CU-P1D: Commitment-First Booking Flow
-- State machine: HELD -> COMMITTED -> CONFIRMED | CANCELED

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TYPE commitment_booking_state AS ENUM (
  'held',
  'committed',
  'confirmed',
  'canceled'
);
CREATE TABLE commitment_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  payment_intent_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  state commitment_booking_state NOT NULL DEFAULT 'held',
  provider_contact_snapshot JSONB,
  customer_contact_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Double-booking prevention: no overlapping slots for same provider when held/committed/confirmed
ALTER TABLE commitment_bookings
  ADD CONSTRAINT commitment_bookings_no_overlap
  EXCLUDE USING gist (
    provider_auth_user_id WITH =,
    tstzrange(slot_start, slot_end) WITH &&
  )
  WHERE (state IN ('held', 'committed', 'confirmed'));
CREATE INDEX idx_commitment_bookings_provider ON commitment_bookings (provider_auth_user_id);
CREATE INDEX idx_commitment_bookings_customer ON commitment_bookings (customer_auth_user_id);
CREATE INDEX idx_commitment_bookings_idempotency ON commitment_bookings (idempotency_key);
CREATE INDEX idx_commitment_bookings_state_expires ON commitment_bookings (state, expires_at);
ALTER TABLE commitment_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage commitment_bookings" ON commitment_bookings
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Customers can view own commitment_bookings" ON commitment_bookings
  FOR SELECT USING (customer_auth_user_id = auth.uid());
CREATE POLICY "Providers can view own commitment_bookings" ON commitment_bookings
  FOR SELECT USING (provider_auth_user_id = auth.uid());
