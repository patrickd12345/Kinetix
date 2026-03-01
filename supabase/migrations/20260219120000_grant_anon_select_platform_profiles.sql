-- Grant anon SELECT on platform.profiles so unauthenticated requests can reach the table.
-- RLS still applies: anon gets 0 rows (auth.uid() is null). Fixes 42501 permission denied
-- for health checks and pre-session flows.
GRANT SELECT ON platform.profiles TO anon;
