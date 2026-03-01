-- Fix: Supabase Auth "Database error deleting user" (local + dashboard)
--
-- Root cause (observed in GoTrue logs):
-- - Deleting an auth user cascades to `public.profiles`
-- - `profiles` has an AFTER DELETE trigger (`cache_invalidation_trigger`)
-- - Trigger function `invalidate_related_cache()` called `enqueue_cache_invalidation(...)` without schema qualification
-- - When executed under the Auth DB role, `search_path` does not include `public`, so Postgres fails with:
--     ERROR: function enqueue_cache_invalidation(unknown, integer) does not exist (SQLSTATE 42883)
--
-- Fix:
-- - Ensure both functions run with `search_path=public`
-- - Schema-qualify the function call from the trigger function

BEGIN;
CREATE OR REPLACE FUNCTION public.enqueue_cache_invalidation(_tag TEXT, _dedup_minutes INTEGER DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Dedup within specified window to avoid storms during bulk operations
  INSERT INTO public.cache_invalidation_queue(tag)
  SELECT _tag
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.cache_invalidation_queue
    WHERE tag = _tag
      AND enqueued_at > NOW() - INTERVAL '1 minute' * _dedup_minutes
      AND processed_at IS NULL
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.invalidate_related_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Invalidate search cache when vendor data changes
  IF TG_TABLE_NAME = 'profiles' THEN
    PERFORM public.enqueue_cache_invalidation('search:vendors', 2);
    PERFORM public.enqueue_cache_invalidation('search:provider', 2);
  END IF;

  -- Invalidate specialty cache when specialties change
  IF TG_TABLE_NAME = 'specialties' THEN
    PERFORM public.enqueue_cache_invalidation('specialties', 1);
    PERFORM public.enqueue_cache_invalidation('search:specialties', 1);
  END IF;

  -- Invalidate service cache when services change
  IF TG_TABLE_NAME = 'services' THEN
    PERFORM public.enqueue_cache_invalidation('services', 1);
    PERFORM public.enqueue_cache_invalidation('search:services', 1);
    PERFORM public.enqueue_cache_invalidation('search:provider', 1);
  END IF;

  -- Invalidate location cache when locations change
  IF TG_TABLE_NAME = 'provider_locations' THEN
    PERFORM public.enqueue_cache_invalidation('location', 1);
    PERFORM public.enqueue_cache_invalidation('search:geo', 1);
    PERFORM public.enqueue_cache_invalidation('search:location', 1);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
COMMIT;
