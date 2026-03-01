-- Ensure pilotmontreal@gmail.com has admin role in platform.profiles (source of truth for app auth).
-- Idempotent: safe to run multiple times.
-- When they sign in with Google, they get full admin access.

-- 1) One-time: set admin for existing user (if they already have a profile)
update platform.profiles
set role = 'admin', updated_at = now()
where id = (select id from auth.users where email = 'pilotmontreal@gmail.com' limit 1)
  and (role is null or role != 'admin');
-- 2) Trigger: when this email signs in for the first time (new row in platform.profiles), set admin
create or replace function platform.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = platform
as $$
declare
  v_role text := 'customer';
begin
  if new.email = 'pilotmontreal@gmail.com' then
    v_role := 'admin';
  end if;
  insert into platform.profiles (id, email, role)
  values (new.id, new.email, v_role)
  on conflict (id) do update set
    email = excluded.email,
    role = case when excluded.role = 'admin' then 'admin' else platform.profiles.role end,
    updated_at = now();
  return new;
end;
$$;
