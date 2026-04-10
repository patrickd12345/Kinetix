export function isAdmlogProductionEnvironment(env = process.env) {
  return env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production'
}

export function isAdmlogEnabled(env = process.env) {
  return env.ADMLOG_ENABLED === 'true' && !isAdmlogProductionEnvironment(env)
}

export function getAdmlogBlockReason(env = process.env) {
  if (isAdmlogProductionEnvironment(env)) {
    return { criteria: 'disabled_in_production', howToEnable: 'Use non-production environment only.' }
  }
  if (!isAdmlogEnabled(env)) {
    return { criteria: 'admlog_not_enabled', howToEnable: 'Set ADMLOG_ENABLED=true in non-production env.' }
  }
  return { criteria: 'enabled', howToEnable: 'Already enabled.' }
}

export async function performAdmlogSignIn(_args) {
  return { access_token: 'stub-access-token', refresh_token: 'stub-refresh-token' }
}
