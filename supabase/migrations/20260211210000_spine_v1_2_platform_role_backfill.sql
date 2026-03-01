-- SPINE_V1.2 — Consolidate authorization role source of truth.
-- Backfill platform.profiles.role from public.profiles.role via auth linkage.
-- Depends on: 20260211123000_platform_spine_v1_inert_foundation.sql
-- Depends on: 20260211125000_platform_profiles_read_columns.sql

begin;
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  ) then
    update platform.profiles pp
    set
      role = p.role,
      updated_at = coalesce(p.updated_at, pp.updated_at, now())
    from public.profiles p
    where p.auth_user_id = pp.id
      and p.role is not null
      and pp.role is distinct from p.role;
  end if;
end
$$;
commit;
