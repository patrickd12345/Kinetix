-- Planned races for Kinetix Settings + coaching chat context.
-- profile_id = platform.profiles.id = auth.users.id.

begin;

create table if not exists kinetix.planned_races (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references platform.profiles(id) on delete cascade,
  race_name text not null,
  race_date date not null,
  distance_meters integer not null,
  goal_time_seconds integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kinetix_planned_races_profile_id_idx
  on kinetix.planned_races(profile_id);

create index if not exists kinetix_planned_races_profile_race_date_idx
  on kinetix.planned_races(profile_id, race_date);

drop trigger if exists trg_kinetix_planned_races_updated_at on kinetix.planned_races;

create trigger trg_kinetix_planned_races_updated_at
  before update on kinetix.planned_races
  for each row execute function platform.set_updated_at();

grant select, insert, update, delete on table kinetix.planned_races to authenticated;
grant all privileges on table kinetix.planned_races to service_role;

alter table kinetix.planned_races enable row level security;

drop policy if exists "kinetix_planned_races_select_own" on kinetix.planned_races;
drop policy if exists "kinetix_planned_races_insert_own" on kinetix.planned_races;
drop policy if exists "kinetix_planned_races_update_own" on kinetix.planned_races;
drop policy if exists "kinetix_planned_races_delete_own" on kinetix.planned_races;

create policy "kinetix_planned_races_select_own"
  on kinetix.planned_races for select using (auth.uid() = profile_id);
create policy "kinetix_planned_races_insert_own"
  on kinetix.planned_races for insert with check (auth.uid() = profile_id);
create policy "kinetix_planned_races_update_own"
  on kinetix.planned_races for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "kinetix_planned_races_delete_own"
  on kinetix.planned_races for delete using (auth.uid() = profile_id);

comment on table kinetix.planned_races is
  'User-entered goal races for coaching personalization (date, distance, optional goal time).';

commit;
