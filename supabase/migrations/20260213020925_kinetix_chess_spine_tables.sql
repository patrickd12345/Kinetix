-- Kinetix + Chess spine tables. profile_id = platform.profiles.id = auth.users.id.
-- RLS: authenticated access only to own rows (auth.uid() = profile_id).

begin;
-- Kinetix tables
create table if not exists kinetix.user_settings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references platform.profiles(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id)
);
create index if not exists kinetix_user_settings_profile_id_idx
  on kinetix.user_settings(profile_id);
create table if not exists kinetix.activities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references platform.profiles(id) on delete cascade,
  started_at timestamptz not null,
  duration_s int,
  distance_m numeric,
  source text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kinetix_activities_profile_id_idx
  on kinetix.activities(profile_id);
-- Chess tables
create table if not exists chess.user_settings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references platform.profiles(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id)
);
create index if not exists chess_user_settings_profile_id_idx
  on chess.user_settings(profile_id);
create table if not exists chess.games (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references platform.profiles(id) on delete cascade,
  source text,
  external_game_id text,
  pgn text,
  played_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chess_games_profile_id_idx
  on chess.games(profile_id);
create table if not exists chess.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references platform.profiles(id) on delete cascade,
  game_id uuid not null references chess.games(id) on delete cascade,
  engine text not null,
  depth int not null,
  analysis jsonb not null default '{}'::jsonb,
  analyzed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chess_analysis_runs_profile_id_idx
  on chess.analysis_runs(profile_id);
create index if not exists chess_analysis_runs_game_id_idx
  on chess.analysis_runs(game_id);
-- updated_at triggers (reuse platform.set_updated_at)
drop trigger if exists trg_kinetix_user_settings_updated_at on kinetix.user_settings;
create trigger trg_kinetix_user_settings_updated_at
  before update on kinetix.user_settings
  for each row execute function platform.set_updated_at();
drop trigger if exists trg_kinetix_activities_updated_at on kinetix.activities;
create trigger trg_kinetix_activities_updated_at
  before update on kinetix.activities
  for each row execute function platform.set_updated_at();
drop trigger if exists trg_chess_user_settings_updated_at on chess.user_settings;
create trigger trg_chess_user_settings_updated_at
  before update on chess.user_settings
  for each row execute function platform.set_updated_at();
drop trigger if exists trg_chess_games_updated_at on chess.games;
create trigger trg_chess_games_updated_at
  before update on chess.games
  for each row execute function platform.set_updated_at();
drop trigger if exists trg_chess_analysis_runs_updated_at on chess.analysis_runs;
create trigger trg_chess_analysis_runs_updated_at
  before update on chess.analysis_runs
  for each row execute function platform.set_updated_at();
-- Grants (schemas already granted in spine)
grant select, insert, update, delete on table kinetix.user_settings to authenticated;
grant all privileges on table kinetix.user_settings to service_role;
grant select, insert, update, delete on table kinetix.activities to authenticated;
grant all privileges on table kinetix.activities to service_role;
grant select, insert, update, delete on table chess.user_settings to authenticated;
grant all privileges on table chess.user_settings to service_role;
grant select, insert, update, delete on table chess.games to authenticated;
grant all privileges on table chess.games to service_role;
grant select, insert, update, delete on table chess.analysis_runs to authenticated;
grant all privileges on table chess.analysis_runs to service_role;
-- RLS
alter table kinetix.user_settings enable row level security;
alter table kinetix.activities enable row level security;
alter table chess.user_settings enable row level security;
alter table chess.games enable row level security;
alter table chess.analysis_runs enable row level security;
-- Kinetix: own rows only (profile_id = auth.uid())
create policy "kinetix_user_settings_select_own"
  on kinetix.user_settings for select using (auth.uid() = profile_id);
create policy "kinetix_user_settings_insert_own"
  on kinetix.user_settings for insert with check (auth.uid() = profile_id);
create policy "kinetix_user_settings_update_own"
  on kinetix.user_settings for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "kinetix_user_settings_delete_own"
  on kinetix.user_settings for delete using (auth.uid() = profile_id);
create policy "kinetix_activities_select_own"
  on kinetix.activities for select using (auth.uid() = profile_id);
create policy "kinetix_activities_insert_own"
  on kinetix.activities for insert with check (auth.uid() = profile_id);
create policy "kinetix_activities_update_own"
  on kinetix.activities for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "kinetix_activities_delete_own"
  on kinetix.activities for delete using (auth.uid() = profile_id);
-- Chess: own rows only
create policy "chess_user_settings_select_own"
  on chess.user_settings for select using (auth.uid() = profile_id);
create policy "chess_user_settings_insert_own"
  on chess.user_settings for insert with check (auth.uid() = profile_id);
create policy "chess_user_settings_update_own"
  on chess.user_settings for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "chess_user_settings_delete_own"
  on chess.user_settings for delete using (auth.uid() = profile_id);
create policy "chess_games_select_own"
  on chess.games for select using (auth.uid() = profile_id);
create policy "chess_games_insert_own"
  on chess.games for insert with check (auth.uid() = profile_id);
create policy "chess_games_update_own"
  on chess.games for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "chess_games_delete_own"
  on chess.games for delete using (auth.uid() = profile_id);
create policy "chess_analysis_runs_select_own"
  on chess.analysis_runs for select using (auth.uid() = profile_id);
create policy "chess_analysis_runs_insert_own"
  on chess.analysis_runs for insert with check (auth.uid() = profile_id);
create policy "chess_analysis_runs_update_own"
  on chess.analysis_runs for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "chess_analysis_runs_delete_own"
  on chess.analysis_runs for delete using (auth.uid() = profile_id);
commit;
