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
  const aiModeRaw = pick(env, ['AI_MODE']).toLowerCase()
  const aiMode = aiModeRaw === 'gateway' || aiModeRaw === 'fallback' ? aiModeRaw : 'ollama'

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
    apiRequireAuthRaw: pick(env, ['KINETIX_API_REQUIRE_AUTH']),
    stravaClientId: pick(env, ['VITE_STRAVA_CLIENT_ID', 'STRAVA_CLIENT_ID'], '157217'),
    stravaClientSecret: pick(env, ['STRAVA_CLIENT_SECRET']),
    withingsClientId: pick(env, ['VITE_WITHINGS_CLIENT_ID', 'WITHINGS_CLIENT_ID']),
    withingsClientSecret: pick(env, ['WITHINGS_CLIENT_SECRET']),
    supabaseUrl: pick(env, ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']),
    supabaseAnonKey: pick(env, ['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']),
    supabaseServiceRoleKey: pick(env, ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY']),
    corsAllowedOrigins: pick(env, ['CORS_ALLOWED_ORIGINS', 'ALLOWED_ORIGINS']),
    vercelEnv: pick(env, ['VERCEL_ENV']),
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
  }
}
