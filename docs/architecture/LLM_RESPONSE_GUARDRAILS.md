# LLM Response Guardrails

## Summary

Kinetix coach chat now uses two deterministic safety layers:

1. `verified_math_result` for math-bearing questions
2. `verified_fact_contract` plus response linting for broader factual safety

The active coach-chat pipeline is:

1. `apps/web/src/hooks/useChat.ts`
2. `apps/web/src/lib/ragClient.ts` builds coach context and guardrail payload
3. `api/_lib/ai/requestHandlers.ts` runs the existing math gate first
4. `api/_lib/ai/requestHandlers.ts` appends the coach guardrail system appendix
5. LLM generates a bounded draft
6. `api/_lib/ai/coachResponseGuardrails.ts` renders constrained templates and lints the output
7. `api/_lib/ai/sanitizeCoachText.ts` runs last for cleanup

This guardrail layer is coach-only. `/api/ai-chat` callers that do not send `guardrails.mode = "coach"` keep the old behavior.

## Trusted Vs Untrusted

Trusted inputs:

- `verified_math_result`
- `guardrails.contract.verifiedFacts`
- `guardrails.contract.userStatedFacts`
- retrieved coach-context facts returned from the RAG service
- deterministic template text produced by the API

Untrusted inputs:

- all raw LLM output
- any claim that exists only in freeform prompt text
- any model-only inference without factual support

The API trust boundary is in `api/_lib/ai/requestHandlers.ts`. Raw model text is not returned directly in coach mode.

## Verified Fact Contract

Shared types live in `packages/core/src/chatGuardrails/types.ts`.

Current contract shape:

```ts
interface VerifiedFactContract {
  verifiedFacts: Record<string, unknown>
  userStatedFacts: Record<string, unknown>
  allowedOutputModes: AllowedOutputMode[]
  forbiddenOperations: ForbiddenOperation[]
  provenance: Provenance[]
}
```

Coach context currently populates:

- `verifiedFacts.unitSystem`
- `verifiedFacts.dataAvailability`
- `verifiedFacts.retrievedRunCount`
- `verifiedFacts.retrievedRuns`
- `verifiedFacts.pbPaceToBeat`

The client adds:

- `userStatedFacts.numericMentions`
- `userStatedFacts.goal` when it can be extracted safely from the user message

Do not parse trusted facts back out of the context string. Extend the structured contract instead.

## Provenance Categories

Current provenance kinds:

- `verified_math`
- `verified_fact`
- `user_input`
- `retrieved_context`
- `model_inference`

`model_inference` is never allowed to be the sole basis for:

- numeric values
- performance claims stated as fact
- product-truth statements
- causal conclusions
- predictions
- diagnoses

## Response Lint Rules

The deterministic linter lives in `api/_lib/ai/coachResponseGuardrails.ts`.

Current rules:

- block any number not present in trusted sources
- block derived numeric targets and numeric recommendations
- block likely unit mismatches
- block unsupported predictions
- block unsupported diagnostic or medical statements
- block unsupported physiology claims
- block ranking, trend, improvement, and regression claims
- block strong unhedged coaching advice
- allow hedged coaching language such as `may`, `might`, `could`, `consider`, `you may want`

When lint fails:

- offending sentences are stripped first
- if no trustworthy content remains, the API returns a deterministic fallback template

## Templates / Scaffolds

High-risk coach responses do not return raw model text. The API renders constrained templates for:

- `verified_math`
- `fail_closed_math`
- `verified_run_analysis`
- `comparison`
- `insufficient_data`
- `general_coach_safe`

Math fail-closed behavior remains earlier than all new logic and is still deterministic.

## Fail-Safe Behavior

- math questions still fail closed if deterministic computation cannot answer safely
- coach-mode LLM output is always treated as untrusted until it passes the guardrail pass
- unsupported content is removed or replaced before the response is returned
- if there is no safe content left, the API returns a constrained fallback instead of passing through the draft

## Safe Extension Guidelines

When adding new coach capabilities:

- prefer adding deterministic facts to the contract instead of expanding prompt prose
- add provenance entries for every new trusted fact group
- update the linter before allowing a new claim type
- add a deterministic computation path before enabling rankings, trends, physiology, or predictions
- keep coach-only guardrails opt-in unless another `/api/ai-chat` surface explicitly needs them

If a future feature needs trend, ranking, or physiology claims, first add a deterministic engine that produces verified facts for those claims. Then extend the contract, templates, and tests together.
