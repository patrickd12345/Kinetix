-- SPINE_V2.0: Bookiji schema isolation — move core tables to bookiji, keep public views with write-through triggers.
-- Application code unchanged: PostgREST and RLS continue to use public.<table>; writes go to bookiji.<table>.
-- Idempotent: uses IF EXISTS, DROP VIEW IF EXISTS, DROP TRIGGER IF EXISTS. No schema/table drops.

BEGIN;
-- Ensure bookiji schema exists (SPINE_V1 should have created it)
CREATE SCHEMA IF NOT EXISTS bookiji;
-- =============================================================================
-- 1) MOVE TABLES (dependency order: referenced first, then referencers)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'services') THEN
    ALTER TABLE public.services SET SCHEMA bookiji;
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'provider_locations') THEN
    ALTER TABLE public.provider_locations SET SCHEMA bookiji;
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendor_specialties') THEN
    ALTER TABLE public.vendor_specialties SET SCHEMA bookiji;
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recurring_availability_rules') THEN
    ALTER TABLE public.recurring_availability_rules SET SCHEMA bookiji;
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'availability_slots') THEN
    ALTER TABLE public.availability_slots SET SCHEMA bookiji;
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') THEN
    ALTER TABLE public.bookings SET SCHEMA bookiji;
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'booking_audit_log') THEN
    ALTER TABLE public.booking_audit_log SET SCHEMA bookiji;
  END IF;
END $$;
-- =============================================================================
-- 2) VIEWS + INSTEAD OF TRIGGERS (write-through, RETURNING preserved)
-- =============================================================================

-- ---------- services ----------
DO $$
BEGIN
  IF to_regclass('public.services') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS public_services_instead_insert ON public.services;
    DROP TRIGGER IF EXISTS public_services_instead_update ON public.services;
    DROP TRIGGER IF EXISTS public_services_instead_delete ON public.services;
  END IF;
END $$;
DROP VIEW IF EXISTS public.services;
CREATE VIEW public.services AS SELECT * FROM bookiji.services;
CREATE OR REPLACE FUNCTION public.services_instead_trigger()
RETURNS TRIGGER AS $$
DECLARE r bookiji.services%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO bookiji.services (id, provider_id, name, description, category, subcategory, price, price_type, duration_minutes, is_active, created_at, updated_at)
    VALUES (
      COALESCE(NEW.id, gen_random_uuid()),
      NEW.provider_id, NEW.name, NEW.description, NEW.category, NEW.subcategory, NEW.price, NEW.price_type, NEW.duration_minutes, COALESCE(NEW.is_active, true),
      COALESCE(NEW.created_at, NOW()), COALESCE(NEW.updated_at, NOW())
    )
    RETURNING * INTO r;
    RETURN r;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE bookiji.services SET
      provider_id = NEW.provider_id, name = NEW.name, description = NEW.description, category = NEW.category, subcategory = NEW.subcategory,
      price = NEW.price, price_type = NEW.price_type, duration_minutes = NEW.duration_minutes, is_active = NEW.is_active,
      created_at = NEW.created_at, updated_at = NEW.updated_at
    WHERE id = OLD.id
    RETURNING * INTO r;
    RETURN r;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM bookiji.services WHERE id = OLD.id RETURNING * INTO r;
    RETURN r;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
CREATE TRIGGER public_services_instead_insert INSTEAD OF INSERT ON public.services FOR EACH ROW EXECUTE FUNCTION public.services_instead_trigger();
CREATE TRIGGER public_services_instead_update INSTEAD OF UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.services_instead_trigger();
CREATE TRIGGER public_services_instead_delete INSTEAD OF DELETE ON public.services FOR EACH ROW EXECUTE FUNCTION public.services_instead_trigger();
-- ---------- provider_locations ----------
DO $$
BEGIN
  IF to_regclass('public.provider_locations') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS public_provider_locations_instead_insert ON public.provider_locations;
    DROP TRIGGER IF EXISTS public_provider_locations_instead_update ON public.provider_locations;
    DROP TRIGGER IF EXISTS public_provider_locations_instead_delete ON public.provider_locations;
  END IF;
END $$;
DROP VIEW IF EXISTS public.provider_locations;
CREATE VIEW public.provider_locations AS SELECT * FROM bookiji.provider_locations;
CREATE OR REPLACE FUNCTION public.provider_locations_instead_trigger()
RETURNS TRIGGER AS $$
DECLARE r bookiji.provider_locations%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO bookiji.provider_locations (id, provider_id, address, city, state, country, postal_code, latitude, longitude, service_radius, is_primary, created_at, updated_at)
    VALUES (
      COALESCE(NEW.id, gen_random_uuid()), NEW.provider_id, NEW.address, NEW.city, NEW.state, NEW.country, NEW.postal_code, NEW.latitude, NEW.longitude,
      COALESCE(NEW.service_radius, 10), COALESCE(NEW.is_primary, false), COALESCE(NEW.created_at, NOW()), COALESCE(NEW.updated_at, NOW())
    )
    RETURNING * INTO r;
    RETURN r;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE bookiji.provider_locations SET
      provider_id = NEW.provider_id, address = NEW.address, city = NEW.city, state = NEW.state, country = NEW.country, postal_code = NEW.postal_code,
      latitude = NEW.latitude, longitude = NEW.longitude, service_radius = NEW.service_radius, is_primary = NEW.is_primary, created_at = NEW.created_at, updated_at = NEW.updated_at
    WHERE id = OLD.id
    RETURNING * INTO r;
    RETURN r;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM bookiji.provider_locations WHERE id = OLD.id RETURNING * INTO r;
    RETURN r;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
CREATE TRIGGER public_provider_locations_instead_insert INSTEAD OF INSERT ON public.provider_locations FOR EACH ROW EXECUTE FUNCTION public.provider_locations_instead_trigger();
CREATE TRIGGER public_provider_locations_instead_update INSTEAD OF UPDATE ON public.provider_locations FOR EACH ROW EXECUTE FUNCTION public.provider_locations_instead_trigger();
CREATE TRIGGER public_provider_locations_instead_delete INSTEAD OF DELETE ON public.provider_locations FOR EACH ROW EXECUTE FUNCTION public.provider_locations_instead_trigger();
-- ---------- vendor_specialties ----------
DO $$
BEGIN
  IF to_regclass('public.vendor_specialties') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS public_vendor_specialties_instead_insert ON public.vendor_specialties;
    DROP TRIGGER IF EXISTS public_vendor_specialties_instead_update ON public.vendor_specialties;
    DROP TRIGGER IF EXISTS public_vendor_specialties_instead_delete ON public.vendor_specialties;
  END IF;
END $$;
DROP VIEW IF EXISTS public.vendor_specialties;
CREATE VIEW public.vendor_specialties AS SELECT * FROM bookiji.vendor_specialties;
CREATE OR REPLACE FUNCTION public.vendor_specialties_instead_trigger()
RETURNS TRIGGER AS $$
DECLARE r bookiji.vendor_specialties%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO bookiji.vendor_specialties (id, app_user_id, specialty_id, is_primary, created_at)
    VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.app_user_id, NEW.specialty_id, COALESCE(NEW.is_primary, false), COALESCE(NEW.created_at, NOW()))
    RETURNING * INTO r;
    RETURN r;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE bookiji.vendor_specialties SET app_user_id = NEW.app_user_id, specialty_id = NEW.specialty_id, is_primary = NEW.is_primary, created_at = NEW.created_at WHERE id = OLD.id RETURNING * INTO r;
    RETURN r;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM bookiji.vendor_specialties WHERE id = OLD.id RETURNING * INTO r;
    RETURN r;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
CREATE TRIGGER public_vendor_specialties_instead_insert INSTEAD OF INSERT ON public.vendor_specialties FOR EACH ROW EXECUTE FUNCTION public.vendor_specialties_instead_trigger();
CREATE TRIGGER public_vendor_specialties_instead_update INSTEAD OF UPDATE ON public.vendor_specialties FOR EACH ROW EXECUTE FUNCTION public.vendor_specialties_instead_trigger();
CREATE TRIGGER public_vendor_specialties_instead_delete INSTEAD OF DELETE ON public.vendor_specialties FOR EACH ROW EXECUTE FUNCTION public.vendor_specialties_instead_trigger();
-- ---------- recurring_availability_rules ----------
DO $$
BEGIN
  IF to_regclass('public.recurring_availability_rules') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS public_recurring_availability_rules_instead_insert ON public.recurring_availability_rules;
    DROP TRIGGER IF EXISTS public_recurring_availability_rules_instead_update ON public.recurring_availability_rules;
    DROP TRIGGER IF EXISTS public_recurring_availability_rules_instead_delete ON public.recurring_availability_rules;
  END IF;
END $$;
DROP VIEW IF EXISTS public.recurring_availability_rules;
CREATE VIEW public.recurring_availability_rules AS SELECT * FROM bookiji.recurring_availability_rules;
CREATE OR REPLACE FUNCTION public.recurring_availability_rules_instead_trigger()
RETURNS TRIGGER AS $$
DECLARE r bookiji.recurring_availability_rules%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO bookiji.recurring_availability_rules (id, provider_id, service_id, start_time, end_time, recurrence_rule, slot_type, is_active, created_at, updated_at)
    VALUES (
      COALESCE(NEW.id, gen_random_uuid()), NEW.provider_id, NEW.service_id, NEW.start_time, NEW.end_time, NEW.recurrence_rule,
      COALESCE(NEW.slot_type, 'available'), COALESCE(NEW.is_active, true), COALESCE(NEW.created_at, NOW()), COALESCE(NEW.updated_at, NOW())
    )
    RETURNING * INTO r;
    RETURN r;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE bookiji.recurring_availability_rules SET
      provider_id = NEW.provider_id, service_id = NEW.service_id, start_time = NEW.start_time, end_time = NEW.end_time,
      recurrence_rule = NEW.recurrence_rule, slot_type = NEW.slot_type, is_active = NEW.is_active, created_at = NEW.created_at, updated_at = NEW.updated_at
    WHERE id = OLD.id
    RETURNING * INTO r;
    RETURN r;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM bookiji.recurring_availability_rules WHERE id = OLD.id RETURNING * INTO r;
    RETURN r;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
CREATE TRIGGER public_recurring_availability_rules_instead_insert INSTEAD OF INSERT ON public.recurring_availability_rules FOR EACH ROW EXECUTE FUNCTION public.recurring_availability_rules_instead_trigger();
CREATE TRIGGER public_recurring_availability_rules_instead_update INSTEAD OF UPDATE ON public.recurring_availability_rules FOR EACH ROW EXECUTE FUNCTION public.recurring_availability_rules_instead_trigger();
CREATE TRIGGER public_recurring_availability_rules_instead_delete INSTEAD OF DELETE ON public.recurring_availability_rules FOR EACH ROW EXECUTE FUNCTION public.recurring_availability_rules_instead_trigger();
-- ---------- availability_slots ----------
DO $$
BEGIN
  IF to_regclass('public.availability_slots') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS public_availability_slots_instead_insert ON public.availability_slots;
    DROP TRIGGER IF EXISTS public_availability_slots_instead_update ON public.availability_slots;
    DROP TRIGGER IF EXISTS public_availability_slots_instead_delete ON public.availability_slots;
  END IF;
END $$;
DROP VIEW IF EXISTS public.availability_slots;
CREATE VIEW public.availability_slots AS SELECT * FROM bookiji.availability_slots;
CREATE OR REPLACE FUNCTION public.availability_slots_instead_trigger()
RETURNS TRIGGER AS $$
DECLARE r bookiji.availability_slots%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO bookiji.availability_slots (id, provider_id, start_time, end_time, is_available, slot_type, created_at, updated_at, recurring_rule_id)
    VALUES (
      COALESCE(NEW.id, gen_random_uuid()), NEW.provider_id, NEW.start_time, NEW.end_time, COALESCE(NEW.is_available, true),
      COALESCE(NEW.slot_type, 'regular'), COALESCE(NEW.created_at, NOW()), COALESCE(NEW.updated_at, NOW()), NEW.recurring_rule_id
    )
    RETURNING * INTO r;
    RETURN r;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE bookiji.availability_slots SET
      provider_id = NEW.provider_id, start_time = NEW.start_time, end_time = NEW.end_time, is_available = NEW.is_available, slot_type = NEW.slot_type,
      created_at = NEW.created_at, updated_at = NEW.updated_at, recurring_rule_id = NEW.recurring_rule_id
    WHERE id = OLD.id
    RETURNING * INTO r;
    RETURN r;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM bookiji.availability_slots WHERE id = OLD.id RETURNING * INTO r;
    RETURN r;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
CREATE TRIGGER public_availability_slots_instead_insert INSTEAD OF INSERT ON public.availability_slots FOR EACH ROW EXECUTE FUNCTION public.availability_slots_instead_trigger();
CREATE TRIGGER public_availability_slots_instead_update INSTEAD OF UPDATE ON public.availability_slots FOR EACH ROW EXECUTE FUNCTION public.availability_slots_instead_trigger();
CREATE TRIGGER public_availability_slots_instead_delete INSTEAD OF DELETE ON public.availability_slots FOR EACH ROW EXECUTE FUNCTION public.availability_slots_instead_trigger();
-- ---------- bookings ----------
DO $$
BEGIN
  IF to_regclass('public.bookings') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS public_bookings_instead_insert ON public.bookings;
    DROP TRIGGER IF EXISTS public_bookings_instead_update ON public.bookings;
    DROP TRIGGER IF EXISTS public_bookings_instead_delete ON public.bookings;
  END IF;
END $$;
DROP VIEW IF EXISTS public.bookings;
CREATE VIEW public.bookings AS SELECT * FROM bookiji.bookings;
CREATE OR REPLACE FUNCTION public.bookings_instead_trigger()
RETURNS TRIGGER AS $$
DECLARE r bookiji.bookings%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO bookiji.bookings (
      id, customer_id, provider_id, service_id, start_time, end_time, status, total_amount, notes, cancellation_reason, created_at, updated_at,
      quote_id, state, stripe_payment_intent_id, idempotency_key, confirmed_at, cancelled_at, cancelled_reason, refunded_at, receipt_url, price_cents,
      hold_expires_at, vendor_created, vendor_created_by, booking_origin
    )
    VALUES (
      COALESCE(NEW.id, gen_random_uuid()), NEW.customer_id, NEW.provider_id, NEW.service_id, NEW.start_time, NEW.end_time,
      COALESCE(NEW.status, 'pending'), NEW.total_amount, NEW.notes, NEW.cancellation_reason, COALESCE(NEW.created_at, NOW()), COALESCE(NEW.updated_at, NOW()),
      NEW.quote_id, NEW.state, NEW.stripe_payment_intent_id, NEW.idempotency_key, NEW.confirmed_at, NEW.cancelled_at, NEW.cancelled_reason, NEW.refunded_at, NEW.receipt_url, NEW.price_cents,
      NEW.hold_expires_at, COALESCE(NEW.vendor_created, false), NEW.vendor_created_by, COALESCE(NEW.booking_origin, 'provider_direct')
    )
    RETURNING * INTO r;
    RETURN r;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE bookiji.bookings SET
      customer_id = NEW.customer_id, provider_id = NEW.provider_id, service_id = NEW.service_id, start_time = NEW.start_time, end_time = NEW.end_time,
      status = NEW.status, total_amount = NEW.total_amount, notes = NEW.notes, cancellation_reason = NEW.cancellation_reason, created_at = NEW.created_at, updated_at = NEW.updated_at,
      quote_id = NEW.quote_id, state = NEW.state, stripe_payment_intent_id = NEW.stripe_payment_intent_id, idempotency_key = NEW.idempotency_key,
      confirmed_at = NEW.confirmed_at, cancelled_at = NEW.cancelled_at, cancelled_reason = NEW.cancelled_reason, refunded_at = NEW.refunded_at, receipt_url = NEW.receipt_url, price_cents = NEW.price_cents,
      hold_expires_at = NEW.hold_expires_at, vendor_created = NEW.vendor_created, vendor_created_by = NEW.vendor_created_by, booking_origin = NEW.booking_origin
    WHERE id = OLD.id
    RETURNING * INTO r;
    RETURN r;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM bookiji.bookings WHERE id = OLD.id RETURNING * INTO r;
    RETURN r;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
CREATE TRIGGER public_bookings_instead_insert INSTEAD OF INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.bookings_instead_trigger();
CREATE TRIGGER public_bookings_instead_update INSTEAD OF UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.bookings_instead_trigger();
CREATE TRIGGER public_bookings_instead_delete INSTEAD OF DELETE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.bookings_instead_trigger();
-- ---------- booking_audit_log ----------
DO $$
BEGIN
  IF to_regclass('public.booking_audit_log') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS public_booking_audit_log_instead_insert ON public.booking_audit_log;
    DROP TRIGGER IF EXISTS public_booking_audit_log_instead_update ON public.booking_audit_log;
    DROP TRIGGER IF EXISTS public_booking_audit_log_instead_delete ON public.booking_audit_log;
  END IF;
END $$;
DROP VIEW IF EXISTS public.booking_audit_log;
CREATE VIEW public.booking_audit_log AS SELECT * FROM bookiji.booking_audit_log;
CREATE OR REPLACE FUNCTION public.booking_audit_log_instead_trigger()
RETURNS TRIGGER AS $$
DECLARE r bookiji.booking_audit_log%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO bookiji.booking_audit_log (id, booking_id, from_state, to_state, action, actor_type, actor_id, metadata, created_at)
    VALUES (
      COALESCE(NEW.id, gen_random_uuid()), NEW.booking_id, NEW.from_state, NEW.to_state, NEW.action, NEW.actor_type, NEW.actor_id, NEW.metadata, COALESCE(NEW.created_at, NOW())
    )
    RETURNING * INTO r;
    RETURN r;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE bookiji.booking_audit_log SET
      booking_id = NEW.booking_id, from_state = NEW.from_state, to_state = NEW.to_state, action = NEW.action, actor_type = NEW.actor_type, actor_id = NEW.actor_id, metadata = NEW.metadata, created_at = NEW.created_at
    WHERE id = OLD.id
    RETURNING * INTO r;
    RETURN r;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM bookiji.booking_audit_log WHERE id = OLD.id RETURNING * INTO r;
    RETURN r;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
CREATE TRIGGER public_booking_audit_log_instead_insert INSTEAD OF INSERT ON public.booking_audit_log FOR EACH ROW EXECUTE FUNCTION public.booking_audit_log_instead_trigger();
CREATE TRIGGER public_booking_audit_log_instead_update INSTEAD OF UPDATE ON public.booking_audit_log FOR EACH ROW EXECUTE FUNCTION public.booking_audit_log_instead_trigger();
CREATE TRIGGER public_booking_audit_log_instead_delete INSTEAD OF DELETE ON public.booking_audit_log FOR EACH ROW EXECUTE FUNCTION public.booking_audit_log_instead_trigger();
-- =============================================================================
-- 3) GRANTS ON PUBLIC VIEWS
-- No write for anon. SELECT/INSERT/UPDATE/DELETE for authenticated + service_role.
-- No anon SELECT (original tables were not publicly selectable by default).
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_locations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_specialties TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_availability_rules TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_slots TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_audit_log TO authenticated, service_role;
-- Underlying table grants move with the table; no change needed for bookiji.* tables.

COMMIT;
-- =============================================================================
-- NOTES: Write-through view trigger approach
-- =============================================================================
-- - public.<table> is a view: SELECT * FROM bookiji.<table>. PostgREST and app
--   keep using public.<table>; no code change.
-- - INSTEAD OF INSERT/UPDATE/DELETE triggers run in SECURITY DEFINER and forward
--   the operation to bookiji.<table>. RETURNING * is captured from the underlying
--   DML and returned from the trigger so PostgREST gets correct inserted/updated
--   rows (including generated id, timestamps).
-- - RLS: policies live on bookiji.<table>; the view has no RLS. PostgREST uses
--   the view, but the underlying table RLS is applied when the trigger runs the
--   INSERT/UPDATE/DELETE (as the definer). For SELECT, the view is just a pass-
--   through so RLS on bookiji.<table> applies when reading.
-- - Triggers on bookiji.<table> (e.g. updated_at, log_booking_state_change) still
--   fire when the INSTEAD OF trigger performs DML on the table.
--
-- VERIFICATION CHECKLIST (after applying migration):
-- [ ] SELECT through public.<table> returns rows from bookiji.<table>
-- [ ] INSERT through public.<table> creates rows in bookiji.<table> and returns
--     the row (including generated id / timestamps)
-- [ ] UPDATE through public.<table> updates bookiji.<table> and returns updated row
-- [ ] DELETE through public.<table> deletes from bookiji.<table> and returns deleted row
-- [ ] RLS: as authenticated, only allowed rows are visible/editable via the view
-- [ ] Triggers on bookiji.<table> (e.g. updated_at, audit) still fire on view writes;
