# Kinetix AI Reliability Report

Audit date: 2026-04-11

## AI Surfaces

- Chat UI: `apps/web/src/hooks/useChat.ts`, `apps/web/src/pages/Chat.tsx`.
- Run analysis modal/history: `apps/web/src/hooks/useAICoach.ts`.
- Server handlers: `api/ai-chat/index.ts`, `api/ai-coach/index.ts`, `api/_lib/ai/requestHandlers.ts`.
- Deterministic safety: `chatMathGate.ts`, `coachResponseGuardrails.ts`, `sanitizeCoachText.ts`, `packages/core/src/chatMath/*`, `packages/core/src/chatGuardrails/*`.
- RAG: `apps/rag/ragHttpApp.js`, `apps/rag/services/*`, `apps/web/src/lib/ragClient.ts`.

## Test Evidence

- API AI guardrail tests passed: chat math gate, response guardrails, sanitize coach text, request handlers.
- AI route error contract tests passed.
- AI runtime fallback tests passed.
- Playwright AI chat smoke passed.
- RAG service tests passed for support KB/tickets/status; RAG run Chroma behavior is partly mocked/static.

## Findings

| ID | Severity | Evidence | Finding |
|---|---|---|---|
| AI-01 | P1 | `useAICoach.ts` asks `/api/ai-coach` for JSON text and falls back to substring if parsing fails. | Coach modal can show unstructured model prose without schema validation or deterministic fallback fields. |
| AI-02 | P2 | `/api/ai-coach` uses generic prompt and temperature 0.7, unlike chat guardrails. | Run analysis has weaker hallucination prevention than chat. |
| AI-03 | P2 | `api/_lib/ai/llmClient.ts` and RAG AI client use 60s timeouts; Help support AI uses 90s. | Timeout behavior exists but may exceed acceptable interactive latency. |
| AI-04 | P2 | RAG `/coach-context` returns 200 fallback when Chroma unavailable. | Safe from crash, but UI must clearly disclose lower personalization; Layout only shows banner after repeated startup sync failures. |
| AI-05 | P2 | `useChat.ts` includes strong prompt and guardrail payload; tests cover guardrail application. | Chat safety is comparatively strong; residual risk is model output not fully structured. |
| AI-06 | P3 | BYOK headers are rejected on AI endpoints and tested. | Good control; document current no-BYOK behavior in API docs if public. |

## Deterministic Safety Summary

Strong:
- Verified math gate can fail closed.
- Coach response guardrails reject/replace unsafe numeric claims.
- Sanitization removes internal placeholder/debug language.
- RAG fallback contract forbids invented numbers.

Weak:
- `/api/ai-coach` does not use the same guardrail contract.
- Run analysis JSON is not schema-validated.
- Long AI timeouts can make failure modes feel stuck.

