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

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ firstResponseHours: number, resolutionHours: number }}
 */
export function parseSupportSlaHours(env = getDefaultEnv()) {
  const firstRaw = pick(env, ['KINETIX_SUPPORT_SLA_FIRST_RESPONSE_HOURS'], '4')
  const resRaw = pick(env, ['KINETIX_SUPPORT_SLA_RESOLUTION_HOURS'], '72')
  const first = Number.parseInt(String(firstRaw), 10)
  const res = Number.parseInt(String(resRaw), 10)
  return {
    firstResponseHours: Number.isFinite(first) && first > 0 ? first : 4,
    resolutionHours: Number.isFinite(res) && res > 0 ? res : 72,
  }
}

/**
 * @param {string} createdAtIso
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ firstResponseDueAt: string, resolutionDueAt: string }}
 */
export function computeSlaDueDatesFromCreatedAt(createdAtIso, env = getDefaultEnv()) {
  const created = new Date(createdAtIso)
  if (Number.isNaN(created.getTime())) {
    const now = new Date().toISOString()
    return { firstResponseDueAt: now, resolutionDueAt: now }
  }
  const { firstResponseHours, resolutionHours } = parseSupportSlaHours(env)
  const first = new Date(created.getTime() + firstResponseHours * 60 * 60 * 1000)
  const resolution = new Date(created.getTime() + resolutionHours * 60 * 60 * 1000)
  return {
    firstResponseDueAt: first.toISOString(),
    resolutionDueAt: resolution.toISOString(),
  }
}
