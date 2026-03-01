-- Expose platform and bookiji schemas to PostgREST API.
-- Required for .schema('platform').from('profiles') and bookiji table queries.
-- PGRST106: "Invalid schema: platform" occurs without this.
-- https://supabase.com/docs/guides/troubleshooting/pgrst106-the-schema-must-be-one-of-the-following-error-when-querying-an-exposed-schema

ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, platform, bookiji';
