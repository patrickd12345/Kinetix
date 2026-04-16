import { describe, expect, it } from 'vitest'
import { sanitizeCoachAssistantText } from './sanitizeCoachText.js'

describe('sanitizeCoachAssistantText', () => {
  it('removes user_agency placeholder and llmClient pipe tokens', () => {
    const raw =
      'To reply to [user_agency], here is advice.\n\n| llmClient | llmClie |\n\nStay hydrated.'
    expect(sanitizeCoachAssistantText(raw)).toBe('To reply to here is advice.\n\nStay hydrated.')
  })

  it('fixes dehydra tion split', () => {
    expect(sanitizeCoachAssistantText('Watch for dehydra tion.')).toBe('Watch for dehydration.')
  })

  it('strips echoed persistent memory wrapper', () => {
    const raw =
      'Hi\n[persistent_memory_context]\nfoo\n[/persistent_memory_context]\nRun easy.'
    expect(sanitizeCoachAssistantText(raw)).toBe('Hi\n\nRun easy.')
  })

  it('strips bogus total-pace arithmetic clauses', () => {
    const raw =
      '5:20/km then 5:45/km for a total pace of 11:05/km.'
    const out = sanitizeCoachAssistantText(raw)
    expect(out).not.toMatch(/11:05/)
    expect(out).not.toMatch(/total pace/i)
  })
})
