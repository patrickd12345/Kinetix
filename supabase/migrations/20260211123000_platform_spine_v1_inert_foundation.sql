-- SPINE_V1 (Inert Foundation)
-- Creates schemas + platform tables + RLS + grants only.
-- No product table migration. No app behavior changes.
-- platform.profiles is keyed by auth.users(id); RLS uses auth.uid() = id.

begin;
-- 1) Schemas
create schema if not exists platform;
create schema if not exists bookiji;
create schema if not exists kinetix;
create schema if not exists chess;
-- 2) Platform tables

-- profiles keyed directly by auth.users(id); no auth_user_id column
create table if not exists platform.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'customer',
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists platform.stripe_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  provider text not null default 'stripe',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
create index if not exists platform_stripe_customers_user_id_idx
  on platform.stripe_customers(user_id);
create table if not exists platform.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_key text not null check (product_key in ('bookiji', 'kinetix', 'chess')),
  entitlement_key text not null,
  active boolean not null default true,
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_key, entitlement_key)
);
create index if not exists platform_entitlements_user_product_idx
  on platform.entitlements(user_id, product_key);
create table if not exists platform.feature_flags (
  id uuid primary key default gen_random_uuid(),
  product_key text not null check (product_key in ('platform', 'bookiji', 'kinetix', 'chess')),
  flag_key text not null,
  enabled boolean not null default false,
  description text,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_key, flag_key)
);
create table if not exists platform.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  external_event_id text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, external_event_id)
);
create index if not exists platform_billing_events_user_id_idx
  on platform.billing_events(user_id);
-- 3) updated_at trigger function (schema-local)
create or replace function platform.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_platform_profiles_updated_at on platform.profiles;
create trigger trg_platform_profiles_updated_at
before update on platform.profiles
for each row execute function platform.set_updated_at();
drop trigger if exists trg_platform_stripe_customers_updated_at on platform.stripe_customers;
create trigger trg_platform_stripe_customers_updated_at
before update on platform.stripe_customers
for each row execute function platform.set_updated_at();
drop trigger if exists trg_platform_entitlements_updated_at on platform.entitlements;
create trigger trg_platform_entitlements_updated_at
before update on platform.entitlements
for each row execute function platform.set_updated_at();
drop trigger if exists trg_platform_feature_flags_updated_at on platform.feature_flags;
create trigger trg_platform_feature_flags_updated_at
before update on platform.feature_flags
for each row execute function platform.set_updated_at();
-- 4) Grants (required so RLS-governed access works for anon/authenticated)

grant usage on schema platform to anon, authenticated, service_role;
grant usage on schema bookiji to anon, authenticated, service_role;
grant usage on schema kinetix to anon, authenticated, service_role;
grant usage on schema chess to anon, authenticated, service_role;
grant select, update on table platform.profiles to authenticated;
grant select on table platform.stripe_customers to authenticated;
grant select on table platform.entitlements to authenticated;
grant select on table platform.feature_flags to authenticated;
grant all privileges on table platform.profiles to service_role;
grant all privileges on table platform.stripe_customers to service_role;
grant all privileges on table platform.entitlements to service_role;
grant all privileges on table platform.feature_flags to service_role;
grant all privileges on table platform.billing_events to service_role;
alter default privileges in schema platform grant select on tables to authenticated;
alter default privileges in schema platform grant all on tables to service_role;
-- 5) RLS

alter table platform.profiles enable row level security;
alter table platform.stripe_customers enable row level security;
alter table platform.entitlements enable row level security;
alter table platform.feature_flags enable row level security;
alter table platform.billing_events enable row level security;
-- platform.profiles: users can select/update only their own row (id = auth.uid())
create policy "profiles_select_own"
  on platform.profiles for select
  using (auth.uid() = id);
create policy "profiles_update_own"
  on platform.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
create policy "profiles_insert_service_role"
  on platform.profiles for insert
  with check (auth.role() = 'service_role');
create policy "profiles_update_service_role"
  on platform.profiles for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
-- platform.stripe_customers: users read own; service role write
create policy "stripe_customers_select_own"
  on platform.stripe_customers for select
  using (auth.uid() = user_id);
create policy "stripe_customers_insert_service_role"
  on platform.stripe_customers for insert
  with check (auth.role() = 'service_role');
create policy "stripe_customers_update_service_role"
  on platform.stripe_customers for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
-- platform.entitlements: users read own; service role write
create policy "entitlements_select_own"
  on platform.entitlements for select
  using (auth.uid() = user_id);
create policy "entitlements_insert_service_role"
  on platform.entitlements for insert
  with check (auth.role() = 'service_role');
create policy "entitlements_update_service_role"
  on platform.entitlements for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "entitlements_delete_service_role"
  on platform.entitlements for delete
  using (auth.role() = 'service_role');
-- platform.billing_events: service role only
create policy "billing_events_service_role_all"
  on platform.billing_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
-- platform.feature_flags: authenticated read; service role write
create policy "feature_flags_authenticated_select"
  on platform.feature_flags for select
  using (auth.role() = 'authenticated' or auth.role() = 'service_role');
create policy "feature_flags_service_role_insert"
  on platform.feature_flags for insert
  with check (auth.role() = 'service_role');
create policy "feature_flags_service_role_update"
  on platform.feature_flags for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "feature_flags_service_role_delete"
  on platform.feature_flags for delete
  using (auth.role() = 'service_role');
commit;
