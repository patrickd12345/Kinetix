grant usage on schema myassist to anon, authenticated, service_role;;
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, platform, bookiji, kinetix, chess, myassist';;
notify pgrst, 'reload config';;
notify pgrst, 'reload schema';;
