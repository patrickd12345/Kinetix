-- Migration: Reject claim when slot overlaps external calendar busy
-- Phase-1 subtractive model: DB is authoritative; external busy must not be double-booked.
-- Rejects claims when the slot overlaps any external_calendar_events row with is_busy=true.

CREATE OR REPLACE FUNCTION claim_slot_and_create_booking(
  p_slot_id UUID,
  p_booking_id UUID,
  p_customer_id UUID,
  p_provider_id UUID,
  p_service_id UUID,
  p_total_amount DECIMAL(8,2) DEFAULT 0
)
RETURNS TABLE (
  success BOOLEAN,
  booking_id UUID,
  error_message TEXT
) AS $$
DECLARE
  v_slot availability_slots%ROWTYPE;
  v_booking bookings%ROWTYPE;
  v_now TIMESTAMPTZ;
  v_overlaps_busy BOOLEAN;
BEGIN
  v_now := NOW();

  SELECT * INTO v_slot FROM availability_slots WHERE id = p_slot_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Slot not found'::TEXT;
    RETURN;
  END IF;

  IF NOT v_slot.is_available THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Slot is not available'::TEXT;
    RETURN;
  END IF;

  IF v_slot.provider_id != p_provider_id THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Slot provider mismatch'::TEXT;
    RETURN;
  END IF;

  IF v_slot.start_time <= v_now THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Cannot create booking in the past'::TEXT;
    RETURN;
  END IF;

  -- Reject if slot overlaps external calendar busy
  SELECT EXISTS (
    SELECT 1 FROM external_calendar_events e
    WHERE e.provider_id = p_provider_id
      AND e.is_busy = true
      AND v_slot.start_time < e.end_time
      AND v_slot.end_time > e.start_time
  ) INTO v_overlaps_busy;

  IF v_overlaps_busy THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Slot overlaps external calendar busy'::TEXT;
    RETURN;
  END IF;

  UPDATE availability_slots SET is_available = false, updated_at = NOW() WHERE id = p_slot_id;

  INSERT INTO bookings (id, customer_id, provider_id, service_id, start_time, end_time, status, total_amount)
  VALUES (p_booking_id, p_customer_id, p_provider_id, p_service_id, v_slot.start_time, v_slot.end_time, 'pending', p_total_amount)
  RETURNING * INTO v_booking;

  RETURN QUERY SELECT true, v_booking.id, NULL::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    UPDATE availability_slots SET is_available = true, updated_at = NOW() WHERE id = p_slot_id;
    RETURN QUERY SELECT false, NULL::UUID, SQLERRM::TEXT;
END;
$$ LANGUAGE plpgsql;
