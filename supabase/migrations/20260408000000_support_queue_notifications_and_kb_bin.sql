begin;

alter table if exists kinetix.support_tickets
  add column if not exists internal_notes text not null default '',
  add column if not exists kb_approval_status text not null default 'none',
  add column if not exists kb_approval_bin_id uuid null,
  add column if not exists notification_slack_status text not null default 'pending',
  add column if not exists notification_email_status text not null default 'pending',
  add column if not exists notification_last_attempt_at timestamptz null,
  add column if not exists notification_error_summary text not null default '';

alter table if exists kinetix.support_tickets
  drop constraint if exists kinetix_support_tickets_kb_approval_status_check;

alter table if exists kinetix.support_tickets
  add constraint kinetix_support_tickets_kb_approval_status_check
  check (kb_approval_status in ('none', 'candidate', 'drafted', 'approved', 'ingested', 'rejected'));

alter table if exists kinetix.support_tickets
  drop constraint if exists kinetix_support_tickets_notification_slack_status_check;

alter table if exists kinetix.support_tickets
  add constraint kinetix_support_tickets_notification_slack_status_check
  check (notification_slack_status in ('pending', 'sent', 'failed', 'unconfigured'));

alter table if exists kinetix.support_tickets
  drop constraint if exists kinetix_support_tickets_notification_email_status_check;

alter table if exists kinetix.support_tickets
  add constraint kinetix_support_tickets_notification_email_status_check
  check (notification_email_status in ('pending', 'sent', 'failed', 'unconfigured'));

create table if not exists kinetix.support_kb_approval_bin (
  id uuid primary key default gen_random_uuid(),
  source_ticket_id text not null,
  artifact_id text not null,
  title text not null,
  body_markdown text not null,
  version integer not null default 1,
  review_status text not null default 'draft',
  topic text not null default 'general',
  intent text not null default 'troubleshoot',
  source_type text not null default 'ticket_resolution',
  product text not null default 'kinetix',
  locale text not null default 'en',
  surface text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ingested_at timestamptz null,
  rejected_at timestamptz null,
  created_by text null,
  updated_by text null,
  approved_by text null,
  constraint kinetix_support_kb_approval_bin_source_ticket_id_key unique (source_ticket_id),
  constraint kinetix_support_kb_approval_bin_artifact_id_key unique (artifact_id),
  constraint kinetix_support_kb_approval_bin_review_status_check
    check (review_status in ('draft', 'approved', 'ingested', 'rejected')),
  constraint kinetix_support_kb_approval_bin_topic_check
    check (topic in ('account', 'billing', 'sync', 'import', 'kps', 'charts', 'privacy', 'general')),
  constraint kinetix_support_kb_approval_bin_intent_check
    check (intent in ('howto', 'troubleshoot', 'policy', 'limitation')),
  constraint kinetix_support_kb_approval_bin_source_type_check
    check (source_type in ('editorial', 'ticket_resolution', 'faq')),
  constraint kinetix_support_kb_approval_bin_product_check
    check (product = 'kinetix')
);

create index if not exists kinetix_support_kb_approval_bin_review_status_created_idx
  on kinetix.support_kb_approval_bin (review_status, created_at desc);

create index if not exists kinetix_support_kb_approval_bin_source_ticket_idx
  on kinetix.support_kb_approval_bin (source_ticket_id);

drop trigger if exists trg_kinetix_support_kb_approval_bin_updated_at on kinetix.support_kb_approval_bin;
create trigger trg_kinetix_support_kb_approval_bin_updated_at
  before update on kinetix.support_kb_approval_bin
  for each row execute function platform.set_updated_at();

alter table kinetix.support_kb_approval_bin enable row level security;

grant all privileges on table kinetix.support_kb_approval_bin to service_role;

comment on table kinetix.support_kb_approval_bin is 'Curated KB approval bin for resolved support tickets. Never auto-ingested; operator approval required.';

commit;
