-- Fix: Supabase Auth "Database error deleting user" (permission denied)
--
-- After fixing search_path for cache invalidation functions, GoTrue started failing with:
--   ERROR: permission denied for table cache_invalidation_queue (SQLSTATE 42501)
--
-- The auth service performs user deletion using the `supabase_auth_admin` DB role, which
-- must be able to enqueue cache invalidation rows when the `profiles` DELETE trigger fires.

BEGIN;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cache_invalidation_queue TO supabase_auth_admin;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.cache_invalidation_queue_id_seq TO supabase_auth_admin;
-- Defensive: allow the connection role used by some local stacks.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cache_invalidation_queue TO authenticator;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.cache_invalidation_queue_id_seq TO authenticator;
COMMIT;
