# LLM math guardrails (Kinetix chat)

## Why

Large language models are unreliable for exact running math (pace arithmetic, KPS, conversions). Kinetix treats **numeric truth** as server-side, deterministic code. The model may **explain** verified numbers only.

## Canonical calculators

- **Package:** `@kinetix/core` — `chatMath/*` (parsers, `tryComputeVerifiedMath`, `formatVerifiedMathForPrompt`).
- **KPS:** `kps/calculator.ts` (`calculateKPS`, etc.) — age/weight graded; no exceptions.

## API flow

1. Flatten chat `contents` to a single user string (existing behavior).
2. `runMathGate()` calls `tryComputeVerifiedMath()`:
   - **Not math-bearing** → normal LLM call (unchanged).
   - **`canAnswer: false`** → **fail-closed** plain-text reply from code; **no LLM** (`fallbackReason: verified_math_fail_closed`).
   - **`canAnswer: true`** → append `verified_math_result` JSON and strict system instructions; LLM temperature lowered; **explain only**.

Entry points: `api/_lib/ai/chatMathGate.ts`, `api/_lib/ai/requestHandlers.ts`.

## Verified result contract

See `VerifiedMathResult` in `packages/core/src/chatMath/types.ts`:

- `type: "verified_math_result"`
- `operation`, `inputs`, `outputs`, `formatted`
- `canAnswer`, optional `error` / `missingInputs`

## Fail-closed policy

If a message looks like fitness math but distances/times/profile are ambiguous, the API returns a short clarification request **without** inventing numbers.

## Client responsibilities

`apps/web/src/hooks/useChat.ts` sends `userProfile` `{ age, weightKg }` and `unitSystem` so KPS and pace display align with the runner.

## Adding a new calculator

1. Add pure functions in `packages/core/src/chatMath/` (reuse `kps/*` where possible).
2. Extend `tryComputeVerifiedMath` dispatch with a **narrow** pattern (avoid greedy matching).
3. Add unit tests in `packages/core/src/chatMath/*.test.ts` and `api/_lib/ai/chatMathGate.test.ts`.
4. Do **not** teach the LLM new formulas in prompts — only structured `verified_math_result` fields.

## Last updated

2026-04-08
