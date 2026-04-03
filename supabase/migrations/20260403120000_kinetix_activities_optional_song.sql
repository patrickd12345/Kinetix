-- Optional music metadata per activity for AI coaching (e.g. song BPM vs cadence / run efficiency).
-- PostgREST: expose kinetix schema so clients can use .schema('kinetix').from('activities').

alter table kinetix.activities
  add column if not exists song_title text,
  add column if not exists song_artist text,
  add column if not exists song_bpm integer;

comment on column kinetix.activities.song_title is 'Optional track title if the user linked music to this run.';
comment on column kinetix.activities.song_artist is 'Optional artist name for the linked track.';
comment on column kinetix.activities.song_bpm is 'Optional tempo (beats per minute) for the linked track; compare to cadence for coaching.';

-- Allow REST API access to kinetix.* (was missing from initial platform/bookiji exposure).
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, platform, bookiji, kinetix';
