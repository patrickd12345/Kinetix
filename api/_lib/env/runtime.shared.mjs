function pick(env, keys, fallback = '') {
  for (const key of keys) {
    const value = env[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return fallback
}

function getDefaultEnv() {
  return typeof globalThis !== 'undefined' && globalThis['process']?.env ? globalThis['process'].env : {}
}

export function resolveKinetixRuntimeEnvFromObject(env = getDefaultEnv()) {
  const onVercel =
    env.VERCEL === '1' ||
    (typeof env.VERCEL_ENV === 'string' && env.VERCEL_ENV.trim().length > 0)

  const aiModeRaw = pick(env, ['AI_MODE']).toLowerCase()
  let aiMode
  if (aiModeRaw === 'gateway' || aiModeRaw === 'fallback') {
    aiMode = aiModeRaw
  } else if (aiModeRaw === 'ollama') {
    aiMode = 'ollama'
  } else {
    aiMode = onVercel ? 'gateway' : 'ollama'
  }

  const aiProviderRaw = pick(env, ['AI_PROVIDER', 'KINETIX_LLM_PROVIDER'], aiMode).toLowerCase()
  const aiProvider = aiProviderRaw === 'gateway' ? 'gateway' : 'ollama'

  return {
    aiMode,
    aiProvider,
    vercelAiBaseUrl: pick(env, ['VERCEL_AI_BASE_URL', 'AI_GATEWAY_BASE_URL']),
    vercelVirtualKey: pick(env, ['VERCEL_VIRTUAL_KEY', 'AI_GATEWAY_API_KEY', 'OPENAI_API_KEY']),
    openAiModel: pick(env, ['OPENAI_MODEL', 'AI_GATEWAY_MODEL'], 'gpt-4o-mini'),
    ollamaBaseUrl: pick(env, ['OLLAMA_BASE_URL', 'OLLAMA_API_URL'], 'http://localhost:11434'),
    ollamaModel: pick(env, ['OLLAMA_MODEL', 'LLM_MODEL'], 'llama3.2'),
    /** Ollama model for `/api/embed` (RAG). Keep separate from chat `ollamaModel`; chat LLMs are not valid embedding models. */
    ollamaEmbedModel: pick(
      env,
      ['OLLAMA_EMBED_MODEL', 'KINETIX_OLLAMA_EMBEDDING_MODEL', 'EMBEDDING_MODEL', 'OLLAMA_EMBEDDING_MODEL'],
      'nomic-embed-text',
    ),
    apiRequireAuthRaw: pick(env, ['KINETIX_API_REQUIRE_AUTH']),
    stravaClientId: pick(env, ['VITE_STRAVA_CLIENT_ID', 'STRAVA_CLIENT_ID'], '157217'),
    stravaClientSecret: pick(env, ['STRAVA_CLIENT_SECRET']),
    googleClientId: pick(env, ['VITE_GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID'], '915406480058-s855cf6s4dqipjskfqh0egqq1hui6frn.apps.googleusercontent.com'),
    googleClientSecret: pick(env, ['GOOGLE_CLIENT_SECRET']),
    withingsClientId: pick(env, ['VITE_WITHINGS_CLIENT_ID', 'WITHINGS_CLIENT_ID']),
    withingsClientSecret: pick(env, ['WITHINGS_CLIENT_SECRET']),
    /** Canonical OAuth callback; set on Vercel to https://kinetix.bookiji.com/api/withings-oauth to match Withings partner URL */
    withingsRedirectUri: pick(env, ['WITHINGS_REDIRECT_URI', 'VITE_WITHINGS_REDIRECT_URI']),
    /** Garmin Connect Developer Program (OAuth2 PKCE). Public id may be exposed via Vite; secret server-only. */
    garminConnectClientId: pick(env, ['GARMIN_CONNECT_CLIENT_ID', 'VITE_GARMIN_CONNECT_CLIENT_ID']),
    garminConnectClientSecret: pick(env, ['GARMIN_CONNECT_CLIENT_SECRET']),
    supabaseUrl: pick(env, ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']),
    supabaseAnonKey: pick(env, [
      'SUPABASE_ANON_KEY',
      'VITE_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'VITE_SUPABASE_PUBLISHABLE_KEY',
    ]),
    /** Elevated server key for Auth admin / bypass RLS: prefer next-gen secret (`sb_secret_...`). */
    supabaseServiceRoleKey: pick(env, [
      'SUPABASE_SECRET_KEY',
      'SUPABASE_SERVICE_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ]),
    corsAllowedOrigins: pick(env, ['CORS_ALLOWED_ORIGINS', 'ALLOWED_ORIGINS']),
    nodeEnv: pick(env, ['NODE_ENV']),
    port: pick(env, ['PORT']),
    chromaMode: pick(env, ['CHROMA_MODE'], 'in-memory'),
    chromaPath: pick(env, ['CHROMA_PATH'], './chroma_db'),
    chromaApiUrl: pick(env, ['CHROMA_API_URL']),
    chromaServerUrl: pick(env, ['CHROMA_SERVER_URL']),
    chromaDockerImage: pick(env, ['CHROMA_DOCKER_IMAGE'], 'chromadb/chroma'),
    chromaAutoStartRaw: pick(env, ['CHROMA_AUTO_START']),
    ollamaApiUrl: pick(env, ['OLLAMA_API_URL'], 'http://localhost:11434'),
    ollamaAutoStartRaw: pick(env, ['OLLAMA_AUTO_START']),
    stripeSecretKey: pick(env, ['STRIPE_SECRET_KEY']),
    kinetixStripePriceId: pick(env, ['KINETIX_STRIPE_PRICE_ID']),
    /** Ops-only secret for RAG PATCH /support/ticket/:id/status (see apps/rag README). */
    kinetixSupportOpsSecret: pick(env, ['KINETIX_SUPPORT_OPS_SECRET']),
    kinetixSupportOperatorUserIds: pick(env, ['KINETIX_SUPPORT_OPERATOR_USER_IDS']),
    kinetixSupportSlackWebhookUrl: pick(env, ['KINETIX_SUPPORT_SLACK_WEBHOOK_URL']),
    kinetixSupportEmailTo: pick(env, ['KINETIX_SUPPORT_EMAIL_TO']),
    kinetixSupportEmailFrom: pick(env, ['KINETIX_SUPPORT_EMAIL_FROM']),
    resendApiKey: pick(env, ['RESEND_API_KEY']),
    kinetixAppBaseUrl: pick(env, ['KINETIX_APP_BASE_URL', 'VITE_APP_BASE_URL']),
    kinetixRagBaseUrl: pick(env, ['KINETIX_RAG_BASE_URL', 'VITE_RAG_SERVICE_URL']),
  }
}
