# AI reliability report

## Surfaces

| Surface | Client | Server | Tests |
|---------|--------|--------|-------|
| Coach chat | `src/hooks/useChat.ts` → `POST /api/ai-chat` | `api/ai-chat/index.ts` | `e2e/ai-chat-smoke.spec.ts`, `src/test/ai-route-errors.test.ts` |
| AI coach | `src/hooks/useAICoach.ts` → `POST /api/ai-coach` | `api/ai-coach/index.ts` | API unit tests under `api/_lib/ai/*.test.ts` |
| Guardrails | — | `api/_lib/ai/requestHandlers.ts`, `coachResponseGuardrails.ts`, `sanitizeCoachText.ts`, `chatMathGate.ts` | Multiple Vitest files |

## Runtime behavior (repo evidence)

- **Environment-driven backends:** `api/_lib/env/runtime.ts` resolves `aiMode` / `aiProvider` (gateway vs Ollama vs fallback) from env.
- **Local dev gap:** Default Vite **does not** serve `api/*`; Playwright accepts **404** for `/api/ai-chat` when not deployed, or **502** with structured `ai_execution_failed` when handler runs but LLM fails (`ai-chat-smoke.spec.ts`).
- **Math / hallucination control:** `chatMathGate.test.ts`, `sanitizeCoachText.test.ts`, `coachResponseGuardrails.test.ts` exercise guardrails.

## Gaps

- **No load testing** of AI endpoints.
- **RAG quality** (help center / run sync) not end-to-end validated against a live Ollama in CI.
- **Prompt injection / jailbreak** — not systematically red-teamed in automated tests.

## Recommendations

- Staging smoke: assert `/api/ai-chat` returns 200 with minimal prompt when secrets present.
- Expand **structured error** assertions for timeout paths if not already covered.
