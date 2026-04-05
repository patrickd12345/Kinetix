-- Kinetix Help Center support tickets (operational store; not curated support RAG).
-- Inserts are server-side (RAG service + service role) only.

begin;

create table if not exists kinetix.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_id text not null,
  product_key text not null default 'kinetix',
  user_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'open',
  severity text not null default 'unknown',
  environment text null,
  issue_summary text not null,
  conversation_excerpt jsonb not null default '[]'::jsonb,
  attempted_solutions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  constraint kinetix_support_tickets_ticket_id_key unique (ticket_id),
  constraint kinetix_support_tickets_status_check
    check (status in ('open', 'triaged', 'in_progress', 'resolved', 'closed')),
  constraint kinetix_support_tickets_severity_check
    check (severity in ('unknown', 'low', 'medium', 'high', 'critical'))
);

create index if not exists kinetix_support_tickets_created_at_idx
  on kinetix.support_tickets (created_at desc);

create index if not exists kinetix_support_tickets_status_created_idx
  on kinetix.support_tickets (status, created_at desc);

create index if not exists kinetix_support_tickets_user_id_idx
  on kinetix.support_tickets (user_id);

drop trigger if exists trg_kinetix_support_tickets_updated_at on kinetix.support_tickets;
create trigger trg_kinetix_support_tickets_updated_at
  before update on kinetix.support_tickets
  for each row execute function platform.set_updated_at();

alter table kinetix.support_tickets enable row level security;

grant all privileges on table kinetix.support_tickets to service_role;

comment on table kinetix.support_tickets is 'AI-confirmed Help Center tickets. Not auto-ingested into curated support RAG; reinjection is manual.';

commit;
