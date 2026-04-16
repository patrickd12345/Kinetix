# Kinetix Accessibility Report

Audit date: 2026-04-11

## Automated Results

- `pnpm --filter @kinetix/web test:e2e`: 43 passed, including route audit crawl with axe and shell axe checks in light/dark themes.
- `help-center-a11y.spec.ts`: passed keyboard-reachable controls and axe checks.
- `shell-dashboard.spec.ts`: passed skip-link focus, mobile overflow navigation, and shell axe light/dark.
- `src/test/shell-accessibility-audit.test.ts`: passed semantic token contrast checks and shell/help `outline-none` guard.
- `layout-shell-a11y.integration.test.tsx`: passed layout accessibility integration checks.

## Findings

| ID | Severity | Evidence | Finding |
|---|---|---|---|
| A11Y-01 | P1 | `apps/web/src/pages/History.tsx` icon buttons for Sparkles/Trash2 have no visible text and no `aria-label`. | Screen reader users cannot identify Analyze/Delete run actions reliably. |
| A11Y-02 | P2 | `apps/web/src/pages/Chat.tsx` uses `focus:outline-none`; replacement is border color only. | Focus visibility is weaker than the shared `shell-focus-ring`. |
| A11Y-03 | P2 | `apps/web/src/components/KinetixGoalProgressCard.tsx` select/input controls have no explicit labels. | Form controls rely on visual proximity rather than accessible labels. |
| A11Y-04 | P3 | `apps/web/src/index.css` intentionally sets `.shell-focus-ring { outline: none; }` and replaces it in `:focus-visible`; tests cover audited shell/help controls. | Pattern is acceptable only where replacement class is consistently used. |
| A11Y-05 | P3 | Passing test logs contain expected React error stacks. | Does not affect users, but CI accessibility signal is noisy. |

## Positive Controls

- Skip link exists in `Layout.tsx` and `Login.tsx`.
- Dialog primitive uses portal, `role="dialog"`, `aria-modal`, focus trap, Escape handling, focus restore, and `inert`/`aria-hidden` isolation.
- Mobile navigation overflow is reachable through a named button and dialog.
- Chat message list has `aria-live="polite"`.
- Help search controls have labels and passed keyboard checks.
- Chart points expose keyboard instructions and accessible chart labels.

## Manual Heuristics

No axe violations were observed in the local Playwright audit crawl. Remaining issues are code-level heuristics and coverage gaps, mostly icon-only controls and inconsistent focus classes outside the shell.

