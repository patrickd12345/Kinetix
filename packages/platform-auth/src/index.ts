export function isAdmlogProductionEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production'
}
export function isAdmlogEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ADMLOG_ENABLED === 'true' && !isAdmlogProductionEnvironment(env)
}
export function getAdmlogBlockReason(env: NodeJS.ProcessEnv = process.env): { criteria: string; howToEnable: string } {
  if (isAdmlogProductionEnvironment(env)) {
    return { criteria: 'disabled_in_production', howToEnable: 'Use non-production environment only.' }
  }
  if (!isAdmlogEnabled(env)) {
    return { criteria: 'admlog_not_enabled', howToEnable: 'Set ADMLOG_ENABLED=true in non-production env.' }
  }
  return { criteria: 'enabled', howToEnable: 'Already enabled.' }
}
export async function performAdmlogSignIn(_args: { supabaseUrl: string; serviceKey: string; anonKey: string }) {
  return { access_token: 'stub-access-token', refresh_token: 'stub-refresh-token' }
}
