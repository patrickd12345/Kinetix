-- KX-FEAT-006: Recovery-Aware Coaching Foundation
-- Migrations for Human State snapshots and Coaching Decision logs

begin;

-- 1. Human State Snapshots
create table if not exists kinetix.human_state_snapshots (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references platform.profiles(id) on delete cascade,
  source text not null,
  captured_at timestamptz not null,
  sleep_score int,
  body_battery int,
  stress_level int,
  hrv numeric,
  resting_hr numeric,
  vo2max numeric,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists kinetix_human_state_snapshots_profile_id_idx
  on kinetix.human_state_snapshots(profile_id);
create index if not exists kinetix_human_state_snapshots_captured_at_idx
  on kinetix.human_state_snapshots(captured_at);

-- 2. Coaching Decision Logs
create table if not exists kinetix.coaching_decision_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references platform.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  input_snapshot_id uuid references kinetix.human_state_snapshots(id) on delete set null,
  decision_type text not null,
  decision_code text not null,
  visible_reason text not null,
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb
);

create index if not exists kinetix_coaching_decision_logs_profile_id_idx
  on kinetix.coaching_decision_logs(profile_id);

-- 3. RLS and Grants
alter table kinetix.human_state_snapshots enable row level security;
alter table kinetix.coaching_decision_logs enable row level security;

grant select, insert, update, delete on table kinetix.human_state_snapshots to authenticated;
grant all privileges on table kinetix.human_state_snapshots to service_role;

grant select, insert, update, delete on table kinetix.coaching_decision_logs to authenticated;
grant all privileges on table kinetix.coaching_decision_logs to service_role;

-- Policies: Own rows only
create policy "kinetix_human_state_snapshots_select_own"
  on kinetix.human_state_snapshots for select using (auth.uid() = profile_id);
create policy "kinetix_human_state_snapshots_insert_own"
  on kinetix.human_state_snapshots for insert with check (auth.uid() = profile_id);
create policy "kinetix_human_state_snapshots_delete_own"
  on kinetix.human_state_snapshots for delete using (auth.uid() = profile_id);

create policy "kinetix_coaching_decision_logs_select_own"
  on kinetix.coaching_decision_logs for select using (auth.uid() = profile_id);
create policy "kinetix_coaching_decision_logs_insert_own"
  on kinetix.coaching_decision_logs for insert with check (auth.uid() = profile_id);
create policy "kinetix_coaching_decision_logs_delete_own"
  on kinetix.coaching_decision_logs for delete using (auth.uid() = profile_id);

commit;
