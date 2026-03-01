-- Depends on: 20260211123000_platform_spine_v1_inert_foundation.sql
-- This migration assumes platform schema and platform.profiles exist.
-- Sync new auth.users into platform.profiles (id, email).
-- Trigger: after insert on auth.users.

create or replace function platform.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = platform
as $$
begin
  insert into platform.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists trg_platform_on_auth_user_created on auth.users;
create trigger trg_platform_on_auth_user_created
after insert on auth.users
for each row
execute function platform.handle_new_auth_user();
