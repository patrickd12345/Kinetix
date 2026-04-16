export type UserKeyLoader = (
  userId: string,
  provider: string,
  product: string,
) => Promise<string | null>

let userKeyLoader: UserKeyLoader | null = null

export function setUserKeyLoader(loader: UserKeyLoader | null): void {
  userKeyLoader = loader
}

export async function loadUserKey(userId: string, provider: string, product: string): Promise<string | null> {
  if (!userKeyLoader) {
    return null
  }
  return userKeyLoader(userId, provider, product)
}

function trimEnv(value: string | undefined): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t || null
}

function getProcessEnv(): NodeJS.ProcessEnv {
  if (typeof globalThis !== 'undefined' && (globalThis as { process?: { env?: NodeJS.ProcessEnv } }).process?.env) {
    return (globalThis as { process: { env: NodeJS.ProcessEnv } }).process.env
  }
  return {}
}

type EnvSource = Record<string, string | undefined>

function readEnv(env: EnvSource | undefined, key: string): string | null {
  if (!env) {
    return null
  }
  return trimEnv(env[key])
}

/**
 * Platform-managed API keys from environment (deployment secret store).
 * When `env` is provided (e.g. per-request overrides from ai-runtime), it wins over process.env.
 */
export function getPlatformKey(provider: string, env?: EnvSource): string | null {
  const pe = getProcessEnv()
  const pick = (k: string) => readEnv(env, k) ?? trimEnv(pe[k as keyof NodeJS.ProcessEnv] as string | undefined)
  switch (provider) {
    case 'openai':
      return pick('OPENAI_API_KEY')
    case 'anthropic':
      return pick('ANTHROPIC_API_KEY')
    case 'gemini':
      return pick('GOOGLE_AI_API_KEY') ?? pick('GEMINI_API_KEY')
    case 'gateway':
      return pick('VERCEL_VIRTUAL_KEY') ?? pick('AI_GATEWAY_API_KEY') ?? pick('OPENAI_API_KEY')
    default:
      return null
  }
}
