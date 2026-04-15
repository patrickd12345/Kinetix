/**
 * Strips internal tokens and template junk from coach chat model output.
 * Complements prompt fixes and memory boundary hygiene (no internal surface names in user context).
 */

import { sanitizeCoachPaceMath } from '@kinetix/core'

export function sanitizeCoachAssistantText(text: string): string {
  let s = text.trim()
  if (!s) return s

  s = sanitizeCoachPaceMath(s)

  s = s.replace(/\[persistent_memory_context\][\s\S]*?\[\/persistent_memory_context\]/gi, '')

  s = s.replace(/\[user_agency\]/gi, '')
  s = s.replace(/\[[a-z][a-z0-9_]*_[a-z][a-z0-9_]*\]/gi, '')

  for (let i = 0; i < 8; i += 1) {
    const before = s
    s = s.replace(/\|\s*llmClient(?:\s*:\s*[\w:]+)?\s*\|/gi, ' ')
    s = s.replace(/\|\s*llmClie\w*\s*\|/gi, ' ')
    s = s.replace(/\|\s*[A-Za-z]+Client\s*\|/g, ' ')
    s = s.replace(/\bllmClie\w*\s*\|/gi, ' ')
    s = s.replace(/\|\s*llmClie\w*\b/gi, ' ')
    if (s === before) break
  }

  s = s.replace(/\bdehydra\s+tion\b/gi, 'dehydration')

  s = s.replace(/\bto\s+,/gi, 'to ')
  s = s.replace(/\n[ \t]+\n/g, '\n\n')
  s = s.replace(/[ \t]{2,}/g, ' ')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}
