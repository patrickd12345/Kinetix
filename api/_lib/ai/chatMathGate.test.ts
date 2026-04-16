import { describe, expect, it } from 'vitest'
import { runMathGate } from './chatMathGate.js'

describe('runMathGate', () => {
  it('passes through when message is not math-bearing', () => {
    expect(runMathGate('Tips for recovery this week?', {}).kind).toBe('none')
  })

  it('fail-closes when math is detected but inputs are insufficient', () => {
    const g = runMathGate('average pace of 5:20/km and 5:45/km', {})
    expect(g.kind).toBe('fail_closed')
    if (g.kind === 'fail_closed') {
      expect(g.reply.length).toBeGreaterThan(10)
    }
  })

  it('returns verified block for computable segment average', () => {
    const g = runMathGate('5:20/km and 5:45/km over 1 km each — what is my average pace?', {})
    expect(g.kind).toBe('verified')
    if (g.kind === 'verified') {
      expect(g.promptBlock).toContain('verified_math_result')
      expect(g.promptBlock).toContain('average_pace_segments')
    }
  })
})
