# Comprehensive Audit Report - Kinetix App

**Date:** 2026-04-11

This report consolidates the findings of a comprehensive audit across the Kinetix repository, including the web frontend (\`apps/web\`), backend API routes (\`api/\`), and core packages (\`packages/core\`). The audit evaluated the codebase for accessibility, error contract compliance, observability, CI parity, and environment configuration.

## 1. Accessibility & UX (Remediated)

An automated and manual accessibility audit identified several key issues in the web UI, which have been **remediated** alongside this report:

*   **A11Y-01 / UI-04 (History Delete UX & ARIA Labels):** The \`History.tsx\` page utilized icon-only buttons (Sparkles for analysis, Trash2 for deletion) without proper \`aria-label\` attributes, making them opaque to screen reader users.
    *   *Resolution:* Added descriptive \`aria-label\`s (e.g., \`Analyze ${runDisplayTitle(run)} with AI Coach\`) to the Sparkles button. (The Trash2 button already had one).
*   **A11Y-03 (Form Control Labels):** The \`KinetixGoalProgressCard.tsx\` form inputs and selects lacked explicit labels or \`htmlFor\` associations. Screen readers had to rely on visual proximity.
    *   *Resolution:* Added unique \`id\`s and properly linked them with \`htmlFor\` attributes on the surrounding labels.
*   **A11Y-02 / UI-05 (Focus Ring Consistency):** The \`Chat.tsx\` input relied on \`focus:outline-none\` and only a border color change, resulting in weaker focus visibility compared to the standard \`shell-focus-ring\`.
    *   *Resolution:* Applied the standard Kinetix \`focus-visible:ring-2\` tailwind classes to match the app's overall accessibility standards.

## 2. API Error Contracts & Handling

The repository enforces a strict error contract via \`@bookiji-inc/error-contract\`. Several inconsistencies were found in the \`api/\` directory:

*   **Billing Routes (P0 Priority):** \`api/billing/create-checkout-session/index.ts\` uses a mix of \`sendApiError\` and raw \`{ error: string, message: string }\` responses without a guaranteed \`requestId\`. This is the highest priority for future remediation due to its impact on user-visible payment flows.
*   **AI Routes (P1 Priority):** \`api/ai-chat/index.ts\` and \`api/ai-coach/index.ts\` use raw \`{ code, message }\` objects for early CORS/method rejections, bypassing \`serializeApiError\`.
*   **Strava Proxy (P1 Priority):** \`api/strava-proxy/index.ts\` transparently forwards Strava JSON errors rather than wrapping them in the Kinetix canonical shape.

**Recommendation:** Systematically refactor \`api/billing/*\` to enforce \`sendApiError\` on all error branches to guarantee \`requestId\` propagation for frontend telemetry and tracing.

## 3. Observability

Observability wrappers exist (\`logApiEvent\`, \`logAiEvent\`), but their application is inconsistent:

*   **Escalation Notify (P2 Priority):** \`api/escalationNotify.ts\` uses \`console.warn\` for rate limits and Slack fetch failures instead of structured logging (\`logApiEvent\`), breaking parity with other endpoints.
*   **Billing Checkout:** Missing structured events on some early validation branches before the checkout attempt.

**Recommendation:** Replace \`console.warn\` in \`api/escalationNotify.ts\` with \`logApiEvent\` to ensure operations dashboards capture these failures.

## 4. Environment Uniformity

*   **Dual Naming Conventions:** The web client relies on both \`VITE_SUPABASE_*\` and \`NEXT_PUBLIC_SUPABASE_*\` fallbacks (for compatibility with the Bookiji umbrella). This is documented but increases cognitive load.
*   **Server vs. Client Naming Mismatches:** Escalation uses \`VITE_ENABLE_ESCALATION\` on the server (\`escalationNotify\`), which is unusual since \`VITE_\` is typically reserved for client-side injection.

**Recommendation:** Establish a strict policy separating client-injected config (\`VITE_\`) from server-only secrets in \`api/*\` to avoid accidental leakage.

## 5. CI / Testing

*   **Test Suite Health:** The Vitest suite in \`apps/web\` is extremely healthy (401 tests passing). Playwright E2E suite passes cleanly against local mock data (44 tests).
*   **Coverage Gaps:** The RAG application (\`apps/rag\`) changes do not trigger the primary web CI pipeline. Native applications (\`ios\`, \`watchos\`) currently rely on a manual runbook rather than Xcode UI tests.

**Recommendation:** Add \`apps/rag/**\` to the path filters for GitHub Actions CI to prevent silent breakages in the RAG service.
