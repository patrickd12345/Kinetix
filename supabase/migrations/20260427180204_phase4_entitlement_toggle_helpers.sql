-- Phase 4 helpers for entitlement gating verification.
-- Two SECURITY DEFINER functions allow a service-role caller to flip the
-- Kinetix entitlement for a single test user during release verification,
-- then restore it. Permissions are revoked from anon/authenticated/public,
-- so only callers using the service role JWT can execute them.

set search_path = public, platform;

create or replace function platform.test_revoke_kinetix_entitlement(p_user_id uuid)
returns table (user_id uuid, was_active boolean) as $$
declare
  v_was_active boolean;
begin
  select e.active into v_was_active
  from platform.entitlements e
  where e.user_id = p_user_id
    and e.product_key = 'kinetix'
    and e.entitlement_key = 'default';

  update platform.entitlements e
  set
    active = false,
    ends_at = coalesce(e.ends_at, now()),
    metadata = coalesce(e.metadata, '{}'::jsonb)
      || jsonb_build_object('phase4_test_revoked_at', now()),
    updated_at = now()
  where e.user_id = p_user_id
    and e.product_key = 'kinetix'
    and e.entitlement_key = 'default';

  return query select p_user_id, coalesce(v_was_active, false);
end;
$$ language plpgsql security definer;

create or replace function platform.test_restore_kinetix_entitlement(
  p_user_id uuid,
  p_ends_at timestamptz default null
) returns table (user_id uuid, restored boolean) as $$
begin
  update platform.entitlements e
  set
    active = true,
    starts_at = coalesce(e.starts_at, now()),
    ends_at = p_ends_at,
    metadata = coalesce(e.metadata, '{}'::jsonb)
      || jsonb_build_object('phase4_test_restored_at', now()),
    updated_at = now()
  where e.user_id = p_user_id
    and e.product_key = 'kinetix'
    and e.entitlement_key = 'default';

  return query select p_user_id, found;
end;
$$ language plpgsql security definer;

revoke all on function platform.test_revoke_kinetix_entitlement(uuid)
  from public, anon, authenticated;
revoke all on function platform.test_restore_kinetix_entitlement(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function platform.test_revoke_kinetix_entitlement(uuid)
  to service_role;
grant execute on function platform.test_restore_kinetix_entitlement(uuid, timestamptz)
  to service_role;

comment on function platform.test_revoke_kinetix_entitlement(uuid) is
  'Phase 4 helper: temporarily disables the Kinetix entitlement for a test user. Service role only.';
comment on function platform.test_restore_kinetix_entitlement(uuid, timestamptz) is
  'Phase 4 helper: restores the Kinetix entitlement for a test user. Service role only.';
