-- Ensure pilotmontreal@gmail.com exists and is set as admin in production
-- This migration is idempotent and safe to run multiple times

-- Step 1: Create trigger function that will grant admin role when this user registers
-- This ensures admin role is set even if user registers after migration runs
CREATE OR REPLACE FUNCTION ensure_pilotmontreal_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'pilotmontreal@gmail.com' THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Step 2: Drop and recreate trigger to auto-set admin role for this email
DROP TRIGGER IF EXISTS ensure_pilotmontreal_admin_trigger ON public.profiles;
CREATE TRIGGER ensure_pilotmontreal_admin_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION ensure_pilotmontreal_admin();
-- Step 3: Handle existing user if they exist in auth.users
DO $$
DECLARE
  v_user_id UUID;
  v_app_user_id UUID;
  v_email TEXT := 'pilotmontreal@gmail.com';
  v_full_name TEXT;
BEGIN
  -- Find the user by email in auth.users
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = v_email 
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Get full_name from existing profile or use default
    SELECT COALESCE(full_name, 'Admin User') INTO v_full_name
    FROM public.profiles 
    WHERE (id = v_user_id OR auth_user_id = v_user_id)
    LIMIT 1;
    
    IF v_full_name IS NULL THEN
      v_full_name := 'Admin User';
    END IF;

    -- Update or insert profile with admin role (handle both id and auth_user_id schemas)
    INSERT INTO public.profiles (
      id,
      auth_user_id,
      email,
      full_name,
      role,
      updated_at
    )
    VALUES (
      v_user_id,
      v_user_id,
      v_email,
      v_full_name,
      'admin',
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'admin',
      email = EXCLUDED.email,
      auth_user_id = COALESCE(profiles.auth_user_id, EXCLUDED.auth_user_id),
      updated_at = NOW();
    
    -- Also ensure by auth_user_id if profile exists with different id (backward compatibility)
    UPDATE public.profiles
    SET role = 'admin',
        email = v_email,
        auth_user_id = COALESCE(auth_user_id, v_user_id),
        updated_at = NOW()
    WHERE (auth_user_id = v_user_id OR id = v_user_id)
      AND role != 'admin';

    -- Ensure app_users entry exists
    INSERT INTO public.app_users (
      id,
      auth_user_id,
      display_name
    )
    VALUES (
      gen_random_uuid(),
      v_user_id,
      v_full_name
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, app_users.display_name)
    RETURNING id INTO v_app_user_id;

    -- Get app_user_id if it already existed
    IF v_app_user_id IS NULL THEN
      SELECT id INTO v_app_user_id FROM app_users WHERE auth_user_id = v_user_id;
    END IF;

    -- Ensure admin role in user_roles
    IF v_app_user_id IS NOT NULL THEN
      INSERT INTO public.user_roles (
        app_user_id,
        role
      )
      VALUES (
        v_app_user_id,
        'admin'
      )
      ON CONFLICT (app_user_id, role) DO NOTHING;
    END IF;

    RAISE NOTICE '✓ Granted admin rights to: % (user_id: %)', v_email, v_user_id;
  ELSE
    RAISE NOTICE '⚠ User not found in auth.users for email: %', v_email;
    RAISE NOTICE '  → Trigger created to auto-grant admin role when they register';
    RAISE NOTICE '  → To create the user, use: supabase auth admin create-user --email pilotmontreal@gmail.com';
  END IF;
END $$;
