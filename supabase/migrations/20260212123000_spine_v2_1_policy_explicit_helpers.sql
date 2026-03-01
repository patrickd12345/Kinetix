-- SPINE_V2.1: remove policy-text ambiguity by routing cross-schema checks
-- through helper functions that use explicit public.* references.

BEGIN;
CREATE OR REPLACE FUNCTION public.can_user_view_booking(
  p_customer_id uuid,
  p_provider_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    p_customer_id = auth.uid()
    OR p_provider_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = p_customer_id
        AND p.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = p_provider_id
        AND p.auth_user_id = auth.uid()
    );
$$;
CREATE OR REPLACE FUNCTION public.provider_has_active_subscription(
  p_provider_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.vendor_subscriptions vs ON vs.vendor_id = p.id
    WHERE p.id = p_provider_id
      AND p.auth_user_id = auth.uid()
      AND vs.status IN ('active', 'trialing')
  );
$$;
DROP POLICY IF EXISTS "Users can view own bookings" ON bookiji.bookings;
CREATE POLICY "Users can view own bookings" ON bookiji.bookings
  FOR SELECT
  USING (public.can_user_view_booking(bookiji.bookings.customer_id, bookiji.bookings.provider_id));
DROP POLICY IF EXISTS "Providers with active subscription can manage own availability" ON bookiji.availability_slots;
CREATE POLICY "Providers with active subscription can manage own availability" ON bookiji.availability_slots
  FOR ALL
  USING (public.provider_has_active_subscription(bookiji.availability_slots.provider_id));
COMMIT;
