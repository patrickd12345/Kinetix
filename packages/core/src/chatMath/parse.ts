/** Statute miles per km */
export const KM_PER_MILE = 1.609344

/** Parse mm:ss or m:ss to total seconds (clock), not pace per unit */
export function parseClockTimeToSeconds(text: string): number | null {
  const t = text.trim()
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return null
  if (m[3] != null) {
    const min = Number(m[1])
    const sec = Number(m[2])
    const s2 = Number(m[3])
    if (![min, sec, s2].every((x) => Number.isFinite(x)) || sec >= 60 || s2 >= 60) return null
    return min * 3600 + sec * 60 + s2
  }
  const min = Number(m[1])
  const sec = Number(m[2])
  if (!Number.isFinite(min) || !Number.isFinite(sec) || sec >= 60) return null
  return min * 60 + sec
}

/** Pace token: seconds per km or per mile */
export function parsePaceToken(token: string): { secondsPerUnit: number; unit: 'km' | 'mi' } | null {
  const m = token.trim().match(/^(\d{1,2}):(\d{2})\s*\/\s*(km|mi|mile|miles)\b/i)
  if (!m) return null
  const min = Number(m[1])
  const sec = Number(m[2])
  if (!Number.isFinite(min) || !Number.isFinite(sec) || sec >= 60) return null
  const seconds = min * 60 + sec
  const u = m[3].toLowerCase()
  const unit: 'km' | 'mi' = u === 'km' ? 'km' : 'mi'
  return { secondsPerUnit: seconds, unit }
}

export function paceSecondsPerKmToSecondsPerMi(secPerKm: number): number {
  return secPerKm * KM_PER_MILE
}

export function paceSecondsPerMiToSecondsPerKm(secPerMi: number): number {
  return secPerMi / KM_PER_MILE
}

/** Format seconds per km as mm:ss or mm:ss.d (tenth of a second when needed). */
export function formatPaceSecondsPerKm(secondsPerKm: number): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '?'
  const min = Math.floor(secondsPerKm / 60)
  const sec = secondsPerKm - min * 60
  const sn = Math.round(sec * 10) / 10
  if (Math.abs(sn - Math.round(sn)) < 1e-6) {
    return `${min}:${String(Math.round(sn)).padStart(2, '0')}`
  }
  const whole = Math.floor(sn)
  const fracDigit = Math.round((sn - whole) * 10)
  return `${min}:${String(whole).padStart(2, '0')}.${fracDigit}`
}

/** Extract all pace tokens in order from text */
export function extractPaceTokens(text: string): Array<{ raw: string; secondsPerKm: number }> {
  const re = /(\d{1,2}:\d{2})\s*\/\s*(km|mi|mile|miles)\b/gi
  const out: Array<{ raw: string; secondsPerKm: number }> = []
  let m: RegExpExecArray | null
  const s = text
  while ((m = re.exec(s)) !== null) {
    const p = parsePaceToken(m[0])
    if (!p) continue
    const secKm = p.unit === 'km' ? p.secondsPerUnit : paceSecondsPerMiToSecondsPerKm(p.secondsPerUnit)
    out.push({ raw: m[0], secondsPerKm: secKm })
  }
  return out
}

/** Parse "3 km", "3km", "5k", "2.5 mi" -> meters */
export function extractFirstDistanceMeters(text: string): number | null {
  const km = text.match(/(\d+(?:\.\d+)?)\s*km\b/i)
  if (km) return Number(km[1]) * 1000
  const kShort = text.match(/\b(\d+(?:\.\d+)?)k\b/i)
  if (kShort) return Number(kShort[1]) * 1000
  const mi = text.match(/(\d+(?:\.\d+)?)\s*(?:mi|mile|miles)\b/i)
  if (mi) return Number(mi[1]) * 1609.344
  const m = text.match(/(\d+(?:\.\d+)?)\s*m\b/i)
  if (m && !/km/i.test(text.slice(Math.max(0, m.index! - 2), m.index! + 10))) {
    return Number(m[1])
  }
  return null
}

/** "in 16:20" or "16:20 for" */
export function extractClockDurationSeconds(text: string): number | null {
  const patterns = [
    /\b(?:in|for)\s+(\d{1,2}:\d{2}(?::\d{2})?)\b/i,
    /\b(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:for|in)\s+/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) {
      const sec = parseClockTimeToSeconds(m[1])
      if (sec != null) return sec
    }
  }
  return null
}
