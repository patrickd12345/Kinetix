-- Harden optional song metadata: valid BPM range + lookup indexes.
-- Idempotent: constraint only if missing; indexes use IF NOT EXISTS.

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'kinetix'
      and t.relname = 'activities'
      and c.conname = 'kinetix_activities_song_bpm_check'
  ) then
    alter table kinetix.activities
      add constraint kinetix_activities_song_bpm_check
      check (song_bpm is null or song_bpm between 40 and 240);
  end if;
end $$;

create index if not exists kinetix_activities_song_artist_idx
  on kinetix.activities (song_artist);

create index if not exists kinetix_activities_song_title_idx
  on kinetix.activities (song_title);

create index if not exists kinetix_activities_song_bpm_idx
  on kinetix.activities (song_bpm);
