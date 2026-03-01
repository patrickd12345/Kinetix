-- Phase boundary enforcement: booking_origin + provider immutability
-- Notes:
-- - Uses TEXT + CHECK for booking_origin (no ENUM).
-- - Commitment fees are gated by server-authored booking_origin (not frontend flags, not auth state).

BEGIN;
-- ----------------------------------------------------------------------
-- 1) bookings.booking_origin (server-authored)
-- ----------------------------------------------------------------------

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_origin text;
UPDATE bookings
SET booking_origin = 'provider_direct'
WHERE booking_origin IS NULL;
ALTER TABLE bookings
  ALTER COLUMN booking_origin SET NOT NULL;
ALTER TABLE bookings
  ALTER COLUMN booking_origin SET DEFAULT 'provider_direct';
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_booking_origin_allowed;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_booking_origin_allowed
  CHECK (booking_origin IN ('provider_direct', 'public_intake'));
COMMENT ON COLUMN bookings.booking_origin IS
'Phase boundary: provider_direct vs public_intake (server-authored)';
-- ----------------------------------------------------------------------
-- 2) commitment_bookings.booking_origin (server-authored gate for fees)
-- ----------------------------------------------------------------------

ALTER TABLE commitment_bookings
  ADD COLUMN IF NOT EXISTS booking_origin text;
UPDATE commitment_bookings
SET booking_origin = 'public_intake'
WHERE booking_origin IS NULL;
ALTER TABLE commitment_bookings
  ALTER COLUMN booking_origin SET NOT NULL;
ALTER TABLE commitment_bookings
  ALTER COLUMN booking_origin SET DEFAULT 'public_intake';
ALTER TABLE commitment_bookings
  DROP CONSTRAINT IF EXISTS commitment_bookings_booking_origin_allowed;
ALTER TABLE commitment_bookings
  ADD CONSTRAINT commitment_bookings_booking_origin_allowed
  CHECK (booking_origin IN ('provider_direct', 'public_intake'));
COMMENT ON COLUMN commitment_bookings.booking_origin IS
'Phase boundary gate for commitment fee creation (server-authored)';
-- ----------------------------------------------------------------------
-- 3) DB-level immutability guard: bookings.provider_id cannot change
--    (prevents provider reassignment/inference via updates)
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_booking_provider_reassignment()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.provider_id IS DISTINCT FROM OLD.provider_id THEN
    RAISE EXCEPTION 'provider_id is immutable for bookings (phase boundary)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_prevent_booking_provider_reassignment ON bookings;
CREATE TRIGGER trg_prevent_booking_provider_reassignment
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION prevent_booking_provider_reassignment();
COMMIT;
