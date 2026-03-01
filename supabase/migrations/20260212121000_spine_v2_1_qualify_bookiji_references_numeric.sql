-- SPINE_V2.1 (numeric): qualify all SQL references to Bookiji tables as bookiji.<table>.
-- This migration exists because non-numeric versions (e.g. 20260212A001) are not applied by reset tooling.

BEGIN;
-- Rewrite known functions that still reference Bookiji tables unqualified.
DO $$
DECLARE
  fn record;
  fn_def text;
BEGIN
  FOR fn IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'cancel_expired_holds',
        'check_slot_booking_consistency',
        'claim_slot_and_create_booking',
        'create_slot_atomically',
        'detect_no_shows',
        'get_booking_summary',
        'get_simcity_metrics',
        'log_booking_state_change',
        'materialize_recurring_slots',
        'reschedule_booking_atomically',
        'sync_booking_slot_availability',
        'verify_booking_slot_consistency'
      )
  LOOP
    fn_def := pg_get_functiondef(fn.oid);

    -- Bookiji tables: replace only naked names (never bookiji.<table>).
    fn_def := regexp_replace(fn_def, '([^[:alnum:]_.])services([^[:alnum:]_])', '\1bookiji.services\2', 'g');
    fn_def := regexp_replace(fn_def, '([^[:alnum:]_.])provider_locations([^[:alnum:]_])', '\1bookiji.provider_locations\2', 'g');
    fn_def := regexp_replace(fn_def, '([^[:alnum:]_.])vendor_specialties([^[:alnum:]_])', '\1bookiji.vendor_specialties\2', 'g');
    fn_def := regexp_replace(fn_def, '([^[:alnum:]_.])recurring_availability_rules([^[:alnum:]_])', '\1bookiji.recurring_availability_rules\2', 'g');
    fn_def := regexp_replace(fn_def, '([^[:alnum:]_.])availability_slots([^[:alnum:]_])', '\1bookiji.availability_slots\2', 'g');
    fn_def := regexp_replace(fn_def, '([^[:alnum:]_.])bookings([^[:alnum:]_])', '\1bookiji.bookings\2', 'g');
    fn_def := regexp_replace(fn_def, '([^[:alnum:]_.])booking_audit_log([^[:alnum:]_])', '\1bookiji.booking_audit_log\2', 'g');

    -- Explicit cross-schema dependencies.
    fn_def := regexp_replace(fn_def, '([^[:alnum:]_.])profiles([^[:alnum:]_])', '\1public.profiles\2', 'g');
    fn_def := regexp_replace(fn_def, '([^[:alnum:]_.])vendor_subscriptions([^[:alnum:]_])', '\1public.vendor_subscriptions\2', 'g');

    EXECUTE fn_def;
  END LOOP;
END $$;
-- Recreate analytics materialized views with explicit schema-qualified references.
DROP MATERIALIZED VIEW IF EXISTS public.provider_analytics_daily;
CREATE MATERIALIZED VIEW public.provider_analytics_daily AS
SELECT
  date_trunc('day', b.created_at) AS date,
  p.id AS provider_id,
  p.full_name,
  count(b.id) AS total_bookings,
  count(CASE WHEN b.status = 'completed' THEN 1 ELSE NULL::integer END) AS completed_bookings,
  count(CASE WHEN b.status = 'cancelled' THEN 1 ELSE NULL::integer END) AS cancelled_bookings,
  sum(CASE WHEN b.status = 'completed' THEN COALESCE(b.total_amount, 0::numeric) ELSE 0::numeric END) AS total_revenue,
  avg(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE NULL::numeric END) AS avg_booking_value,
  count(DISTINCT b.customer_id) AS unique_customers
FROM public.profiles p
LEFT JOIN bookiji.bookings b ON p.id = b.provider_id
WHERE p.role = 'vendor'
GROUP BY date_trunc('day', b.created_at), p.id, p.full_name;
DROP MATERIALIZED VIEW IF EXISTS public.specialty_analytics_daily;
CREATE MATERIALIZED VIEW public.specialty_analytics_daily AS
SELECT
  date_trunc('day', b.created_at) AS date,
  s.id AS specialty_id,
  s.name AS specialty_name,
  s.path AS specialty_path,
  count(b.id) AS total_bookings,
  count(DISTINCT b.provider_id) AS active_providers,
  count(DISTINCT b.customer_id) AS unique_customers,
  sum(b.total_amount) AS total_revenue,
  avg(b.total_amount) AS avg_booking_value
FROM public.specialties s
LEFT JOIN bookiji.vendor_specialties vs ON s.id = vs.specialty_id
LEFT JOIN public.profiles p ON vs.app_user_id = p.id
LEFT JOIN bookiji.bookings b ON p.id = b.provider_id
WHERE b.status = 'completed'
GROUP BY date_trunc('day', b.created_at), s.id, s.name, s.path;
DROP MATERIALIZED VIEW IF EXISTS public.geographic_analytics_daily;
CREATE MATERIALIZED VIEW public.geographic_analytics_daily AS
SELECT
  date_trunc('day', b.created_at) AS date,
  pl.city,
  pl.state,
  pl.country,
  count(b.id) AS total_bookings,
  count(DISTINCT b.provider_id) AS active_providers,
  count(DISTINCT b.customer_id) AS unique_customers,
  sum(b.total_amount) AS total_revenue
FROM bookiji.provider_locations pl
JOIN public.profiles p ON pl.provider_id = p.id
LEFT JOIN bookiji.bookings b ON p.id = b.provider_id
WHERE p.role = 'vendor' AND b.status = 'completed'
GROUP BY date_trunc('day', b.created_at), pl.city, pl.state, pl.country;
-- Re-assert RLS policies with explicit profile/subscription schema references.
DROP POLICY IF EXISTS "Users can view own bookings" ON bookiji.bookings;
CREATE POLICY "Users can view own bookings" ON bookiji.bookings
  FOR SELECT
  USING (
    customer_id = auth.uid()
    OR provider_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = bookiji.bookings.customer_id
        AND p.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = bookiji.bookings.provider_id
        AND p.auth_user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Providers with active subscription can manage own availability" ON bookiji.availability_slots;
CREATE POLICY "Providers with active subscription can manage own availability" ON bookiji.availability_slots
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.vendor_subscriptions vs ON vs.vendor_id = p.id
      WHERE p.id = bookiji.availability_slots.provider_id
        AND p.auth_user_id = auth.uid()
        AND vs.status IN ('active', 'trialing')
    )
  );
DROP POLICY IF EXISTS "Users can view audit log for their bookings" ON bookiji.booking_audit_log;
CREATE POLICY "Users can view audit log for their bookings" ON bookiji.booking_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM bookiji.bookings b
      WHERE b.id = bookiji.booking_audit_log.booking_id
        AND b.customer_id = auth.uid()
    )
  );
COMMIT;
