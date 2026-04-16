/** Statute miles per km (pace conversion). */
const KM_PER_MI = 1.609344

function parseMinSecToken(token: string): number | null {
  const m = token.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const min = Number(m[1])
  const sec = Number(m[2])
  if (!Number.isFinite(min) || !Number.isFinite(sec) || sec >= 60) return null
  return min * 60 + sec
}

function formatMinSec(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const min = Math.floor(s / 60)
  const sec = s % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export { sanitizeCoachPaceMath } from '@kinetix/core'

/**
 * When the app is metric, rewrite common US pace patterns (e.g. 8:35/mile) to min/km
 * so coach replies match Settings even if the model slips.
 */
export function rewriteMetricCoachPaces(text: string): string {
  let out = text

  out = out.replace(
    /(\d{1,2}:\d{2})\s*\/\s*(mile|miles|mi)\b/gi,
    (_, pace: string) => {
      const secPerMi = parseMinSecToken(pace)
      if (secPerMi == null) return _
      const secPerKm = secPerMi / KM_PER_MI
      return `${formatMinSec(secPerKm)}/km`
    },
  )

  out = out.replace(/\bper\s+mile\b/gi, 'per km')
  out = out.replace(/\bmin\s*\/\s*mi\b/gi, 'min/km')
  out = out.replace(/\bmile\s+or\s+kilometer\b/gi, 'kilometer')
  out = out.replace(/\bmiles\s+or\s+kilometers\b/gi, 'kilometers')
  out = out.replace(/\beach\s+mile\s+or\s+kilometer\b/gi, 'each kilometer')

  return out
}
