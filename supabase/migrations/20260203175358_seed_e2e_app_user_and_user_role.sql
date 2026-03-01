-- SECURITY DEFINER functions for E2E seeding of app_users and user_roles.
-- Bypass RLS when service role upsert is blocked (e.g. missing INSERT policy).

CREATE OR REPLACE FUNCTION public.seed_e2e_app_user(
  p_auth_user_id uuid,
  p_display_name text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.app_users (auth_user_id, display_name, created_at)
  VALUES (p_auth_user_id, p_display_name, now())
  ON CONFLICT (auth_user_id)
  DO UPDATE SET display_name = EXCLUDED.display_name
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.seed_e2e_user_role(
  p_app_user_id uuid,
  p_role text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (app_user_id, role, granted_at)
  VALUES (p_app_user_id, p_role, now())
  ON CONFLICT (app_user_id, role) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.seed_e2e_app_user(uuid, text) TO service_role, supabase_admin;
GRANT EXECUTE ON FUNCTION public.seed_e2e_user_role(uuid, text) TO service_role, supabase_admin;
