# Accessibility report — web

## Automated

- **axe-core (Playwright):** `e2e/kinetix-audit-crawl.spec.ts` runs `@axe-core/playwright` on each major route; violations summarized in attached `axe-*.json` (per test run output).
- **Existing suite:** `e2e/help-center-a11y.spec.ts`, `e2e/shell-dashboard.spec.ts` (axe in light/dark), `src/integration/layout-shell-a11y.integration.test.tsx`, `src/test/shell-accessibility-audit.test.ts`.

## Results (this environment)

- Playwright E2E **38/38 passed**, including axe-based specs. The audit crawl records **violation counts and rule ids** per route in attachments (not pasted here — see CI artifacts or local `pnpm exec playwright test` output folder).

## Manual / heuristic gaps

- **Screen reader** validation (VoiceOver, NVDA) was **not** performed in this headless environment.
- **Color contrast** beyond axe rules: product should spot-check glassmorphism overlays and dark theme charts.

## Recommendations

- Keep **critical** axe violations at zero in CI (optional strict mode: fail on serious/critical).
- Add periodic manual keyboard walkthrough of **Support queue** tables and **Run dashboard** modals (complex widgets).
