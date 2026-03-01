-- SPINE_V1.1 — Profile Read Activation: extend platform.profiles so app reads can be served from platform.
-- Depends on: 20260211123000_platform_spine_v1_inert_foundation.sql
-- Adds columns read by the app and backfills from public.profiles (by auth_user_id = id link).

begin;
-- Add columns that the app reads from profiles (match public.profiles surface used in selects)
alter table platform.profiles add column if not exists phone text;
alter table platform.profiles add column if not exists avatar_url text;
alter table platform.profiles add column if not exists business_name text;
alter table platform.profiles add column if not exists contact_email text;
alter table platform.profiles add column if not exists city_or_region text;
alter table platform.profiles add column if not exists specializations text[] default '{}';
alter table platform.profiles add column if not exists service_area_radius integer default 10;
alter table platform.profiles add column if not exists verified_at timestamptz;
alter table platform.profiles add column if not exists availability_mode text;
alter table platform.profiles add column if not exists business_hours jsonb default '{}';
alter table platform.profiles add column if not exists timezone text default 'UTC';
alter table platform.profiles add column if not exists preferences jsonb default '{}';
alter table platform.profiles add column if not exists beta_status jsonb;
alter table platform.profiles add column if not exists org_id uuid;
alter table platform.profiles add column if not exists username text;
alter table platform.profiles add column if not exists service_type text;
alter table platform.profiles add column if not exists service_area text;
-- Backfill from public.profiles: use auth_user_id as platform id (platform.id = auth.users.id).
-- Only select columns that exist on public.profiles; others stay null/default on platform.
insert into platform.profiles (
  id, email, role, full_name, phone, avatar_url, business_name, contact_email, city_or_region,
  specializations, service_area_radius, verified_at, availability_mode, business_hours, timezone,
  username, created_at, updated_at
)
select
  p.auth_user_id,
  p.email,
  p.role,
  p.full_name,
  p.phone,
  p.avatar_url,
  p.business_name,
  p.contact_email,
  p.city_or_region,
  coalesce(p.specializations, '{}'),
  coalesce(p.service_area_radius, 10),
  p.verified_at,
  p.availability_mode,
  coalesce(p.business_hours, '{}'),
  coalesce(p.timezone, 'UTC'),
  p.username,
  p.created_at,
  p.updated_at
from public.profiles p
where p.auth_user_id is not null
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role,
  full_name = excluded.full_name,
  phone = excluded.phone,
  avatar_url = excluded.avatar_url,
  business_name = excluded.business_name,
  contact_email = excluded.contact_email,
  city_or_region = excluded.city_or_region,
  specializations = excluded.specializations,
  service_area_radius = excluded.service_area_radius,
  verified_at = excluded.verified_at,
  availability_mode = excluded.availability_mode,
  business_hours = excluded.business_hours,
  timezone = excluded.timezone,
  username = excluded.username,
  updated_at = excluded.updated_at;
commit;
