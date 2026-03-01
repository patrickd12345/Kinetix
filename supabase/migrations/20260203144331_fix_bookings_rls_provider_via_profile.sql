-- Fix bookings RLS: allow providers/customers to see bookings when profile.auth_user_id = auth.uid()
-- (handles schema where profiles.id != auth_user_id)

DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
CREATE POLICY "Users can view own bookings" ON bookings
  FOR SELECT USING (
    customer_id = auth.uid()
    OR provider_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = bookings.customer_id AND p.auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = bookings.provider_id AND p.auth_user_id = auth.uid())
  );
