/** Logical env surface for tests and runtime (Standard 10 — Google AdSense). */
export type AdsenseEnv = Record<string, string | boolean | undefined>

function trimClient(env: AdsenseEnv): string {
  const v = env.VITE_ADSENSE_CLIENT
  return (typeof v === 'string' ? v : '').trim()
}

function isGlobalOff(env: AdsenseEnv): boolean {
  return env.VITE_ADSENSE_GLOBAL_OFF === 'true' || env.VITE_ADSENSE_GLOBAL_OFF === true
}

export function adsenseClientFromEnv(env: AdsenseEnv): string {
  return trimClient(env)
}

export function adsenseSlotFromEnv(env: AdsenseEnv): string {
  const v = env.VITE_ADSENSE_SLOT
  return (typeof v === 'string' ? v : '').trim()
}

export function adsenseApprovalModeFromEnv(env: AdsenseEnv): boolean {
  return env.VITE_ADSENSE_APPROVAL_MODE === 'true' || env.VITE_ADSENSE_APPROVAL_MODE === true
}

export function shouldLoadAdSenseScript(env: AdsenseEnv): boolean {
  const client = trimClient(env)
  if (!client) return false
  if (isGlobalOff(env)) return false
  return true
}

export function shouldShowAdSenseDisplayUnit(env: AdsenseEnv): boolean {
  if (!shouldLoadAdSenseScript(env)) return false
  return Boolean(adsenseSlotFromEnv(env))
}

export function getAdsenseLoaderUrl(client: string): string {
  const q = new URLSearchParams({ client })
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?${q.toString()}`
}

export function shouldLoadAdSense(): boolean {
  return shouldLoadAdSenseScript(import.meta.env as AdsenseEnv)
}

export function shouldShowDisplayAd(): boolean {
  return shouldShowAdSenseDisplayUnit(import.meta.env as AdsenseEnv)
}

export function getPublicAdsenseClient(): string {
  return adsenseClientFromEnv(import.meta.env as AdsenseEnv)
}

export function getPublicAdsenseSlot(): string {
  return adsenseSlotFromEnv(import.meta.env as AdsenseEnv)
}
