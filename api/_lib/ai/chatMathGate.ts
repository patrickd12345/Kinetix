import {
  formatVerifiedMathForPrompt,
  tryComputeVerifiedMath,
  type ChatMathContext,
  type VerifiedMathResult,
} from '@kinetix/core'

export type MathGateOutcome =
  | { kind: 'none' }
  | { kind: 'fail_closed'; reply: string; result: VerifiedMathResult }
  | { kind: 'verified'; promptBlock: string; result: VerifiedMathResult }

const VERIFIED_MATH_SYSTEM_SUPPLEMENT = `MATH SAFETY (mandatory): A verified_math_result block may appear below. You must not invent, recompute, or contradict any numbers in it. Explain the verified facts in plain language only. If the runner asks for something that is not covered by verified_math_result, say what is missing instead of guessing.`

export function buildVerifiedMathSystemAppendix(promptBlock: string): string {
  return `${VERIFIED_MATH_SYSTEM_SUPPLEMENT}\n\n${promptBlock}`
}

export function runMathGate(userContent: string, ctx: ChatMathContext): MathGateOutcome {
  const result = tryComputeVerifiedMath(userContent, ctx)
  if (result == null) {
    return { kind: 'none' }
  }
  if (!result.canAnswer) {
    const reply =
      (typeof result.formatted.safeReply === 'string' && result.formatted.safeReply.trim()) ||
      (typeof result.error === 'string' && result.error.trim()) ||
      'That pacing question cannot be answered without exact distances and times.'
    return { kind: 'fail_closed', reply, result }
  }
  return {
    kind: 'verified',
    result,
    promptBlock: formatVerifiedMathForPrompt(result),
  }
}
