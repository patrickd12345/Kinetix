/**
 * Deterministic cleanup of coach chat text so bogus pace "arithmetic" never ships.
 * LLMs may imitate adding mm:ss paces; pace is not additive — only total time ÷ total distance.
 */

/**
 * Removes clauses and sentences that imply adding or combining segment paces into a third figure.
 * Used on the client after LLM output and should match server-side sanitization.
 */
export function sanitizeCoachPaceMath(text: string): string {
  let s = text.trim()
  if (!s) return s

  // Trailing / mid-sentence bogus "total pace" clauses (expanded variants)
  const bogusClauses = [
    /,?\s*for a total pace of \d{1,2}:\d{2}\/(?:km|mi)\b\.?/gi,
    /,?\s*giving a total pace of \d{1,2}:\d{2}\/(?:km|mi)\b\.?/gi,
    /,?\s*with a total pace of \d{1,2}:\d{2}\/(?:km|mi)\b\.?/gi,
    /,?\s*resulting in a total pace of \d{1,2}:\d{2}\/(?:km|mi)\b\.?/gi,
    /,?\s*combined pace (?:of|is|was) \d{1,2}:\d{2}\/(?:km|mi)\b\.?/gi,
    // "pace A + pace B = pace C" style
    /\d{1,2}:\d{2}\/(?:km|mi)\s*\+\s*\d{1,2}:\d{2}\/(?:km|mi)\s*[=→]\s*\d{1,2}:\d{2}\/(?:km|mi)\b\.?/gi,
    /\d{1,2}:\d{2}\/(?:km|mi)\s+plus\s+\d{1,2}:\d{2}\/(?:km|mi)\s+(?:equals|is)\s+\d{1,2}:\d{2}\/(?:km|mi)\b\.?/gi,
  ]
  for (const re of bogusClauses) {
    s = s.replace(re, '')
  }

  s = s.replace(/[ \t]{2,}/g, ' ')
  s = s.replace(/\n[ \t]+\n/g, '\n\n')
  s = s.replace(/\s+\./g, '.')
  s = s.replace(/,\s*\./g, '.')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}
