-- Operator assignment, SLA-facing timestamps, and KB draft excerpt (additive).

begin;

alter table if exists kinetix.support_tickets
  add column if not exists assigned_to text null,
  add column if not exists assigned_at timestamptz null,
  add column if not exists first_response_due_at timestamptz null,
  add column if not exists resolution_due_at timestamptz null,
  add column if not exists last_operator_action_at timestamptz null;

comment on column kinetix.support_tickets.assigned_to is 'Supabase auth user id of owning operator; null means unassigned.';
comment on column kinetix.support_tickets.assigned_at is 'When assigned_to was last set to a non-null operator.';
comment on column kinetix.support_tickets.first_response_due_at is 'SLA: first operator response due by this time (UTC).';
comment on column kinetix.support_tickets.resolution_due_at is 'SLA: target resolution by this time (UTC).';
comment on column kinetix.support_tickets.last_operator_action_at is 'Last queue mutation by an operator (assign, status, notes, etc.).';

update kinetix.support_tickets
set
  first_response_due_at = coalesce(first_response_due_at, created_at + interval '4 hours'),
  resolution_due_at = coalesce(resolution_due_at, created_at + interval '72 hours')
where first_response_due_at is null
   or resolution_due_at is null;

alter table if exists kinetix.support_kb_approval_bin
  add column if not exists excerpt text not null default '';

comment on column kinetix.support_kb_approval_bin.excerpt is 'Short summary for operators and optional KB chunk prefix; not a substitute for curated body_markdown.';

commit;
