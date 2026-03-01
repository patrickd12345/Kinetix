-- Extend seed_e2e_profile to set vendor-required fields (profiles_vendor_required_fields constraint)
-- so E2E vendor seeding works when RPC fallback is used.

CREATE OR REPLACE FUNCTION public.seed_e2e_profile(
  p_auth_user_id uuid,
  p_email text,
  p_full_name text,
  p_role text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_role = 'vendor' THEN
    INSERT INTO public.profiles (
      id, auth_user_id, email, full_name, role,
      business_name, contact_email, phone, city_or_region,
      created_at, updated_at
    )
    VALUES (
      p_auth_user_id, p_auth_user_id, p_email, p_full_name, p_role,
      'E2E Test Business', p_email, '+15551234567', 'E2E Test City',
      now(), now()
    )
    ON CONFLICT (auth_user_id)
    DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      business_name = EXCLUDED.business_name,
      contact_email = EXCLUDED.contact_email,
      phone = EXCLUDED.phone,
      city_or_region = EXCLUDED.city_or_region,
      updated_at = now();
  ELSE
    INSERT INTO public.profiles (id, auth_user_id, email, full_name, role, created_at, updated_at)
    VALUES (p_auth_user_id, p_auth_user_id, p_email, p_full_name, p_role, now(), now())
    ON CONFLICT (auth_user_id)
    DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      updated_at = now();
  END IF;
END;
$$;
