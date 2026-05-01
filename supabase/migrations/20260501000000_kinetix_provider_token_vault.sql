-- Kinetix provider token vault.
-- Server-side only storage for OAuth provider tokens; clients must not read token material.

begin;

create table if not exists kinetix.provider_token_vault (
  id uuid primary key default gen_random_uuid(),
  product_key text not null default 'kinetix',
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_user_id text null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz null,
  scopes text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kinetix_provider_token_vault_product_check check (product_key = 'kinetix'),
  constraint kinetix_provider_token_vault_provider_check check (provider in ('strava', 'withings')),
  constraint kinetix_provider_token_vault_user_provider_key unique (user_id, provider)
);

create index if not exists kinetix_provider_token_vault_user_idx
  on kinetix.provider_token_vault (user_id);

create index if not exists kinetix_provider_token_vault_provider_idx
  on kinetix.provider_token_vault (provider);

drop trigger if exists trg_kinetix_provider_token_vault_updated_at on kinetix.provider_token_vault;
create trigger trg_kinetix_provider_token_vault_updated_at
  before update on kinetix.provider_token_vault
  for each row execute function platform.set_updated_at();

alter table kinetix.provider_token_vault enable row level security;

revoke all on table kinetix.provider_token_vault from anon, authenticated;
grant all privileges on table kinetix.provider_token_vault to service_role;

comment on table kinetix.provider_token_vault is
  'Server-only OAuth token vault for Kinetix provider integrations. Token columns are intentionally service_role-only.';
comment on column kinetix.provider_token_vault.access_token is 'Provider access token. Never expose to client storage or client-readable APIs.';
comment on column kinetix.provider_token_vault.refresh_token is 'Provider refresh token. Never expose to client storage or client-readable APIs.';

commit;
