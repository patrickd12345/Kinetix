# Kinetix Web accessibility audit (vs `docs/standards/ACCESSIBILITY_STANDARD.md`)

**Last updated:** 2026-04-08  
**Scope:** `products/Kinetix/apps/web` (production routes from `src/App.tsx`).  
**Baseline:** WCAG 2.2 AA-oriented; keyboard, SR, visible focus, labels, dialogs, reduced motion.

## Production routes inventoried

| Route | Page |
|-------|------|
| `/login` | `Login.tsx` |
| `/` | `RunDashboard.tsx` |
| `/history` | `History.tsx` |
| `/weight-history` | `WeightHistory.tsx` |
| `/menu` | `Menu.tsx` |
| `/chat` | `Chat.tsx` |
| `/settings` | `Settings.tsx` |
| `/help` | `HelpCenter.tsx` |
| `/support-queue` | `SupportQueue.tsx` |
| `*` | Redirect to `/` |

## Severity-ranked findings (pre-remediation)

### P0 — Blockers for keyboard / SR / focus

1. **Modal focus not trapped; focus not restored on close** — `RunDashboardModals.tsx` (`BeatTargetModal`, `AICoachModal`): `role="dialog"` present but focus could leave the overlay; no restore to trigger control.
2. **Calendar disclosure** — `RunCalendar.tsx`: toggle `<button>` missing `type="button"`, `aria-expanded`, and `aria-controls` for the calendar panel.
3. **Chat composer** — `Chat.tsx`: text field lacked a programmatic label; send control was icon-only without an accessible name; dynamic errors not announced.
4. **Charts** — `MaxKPSPaceDurationChart.tsx` / `Kps100CurveChart.tsx`: point selection via `<g onClick>` only — not keyboard-operable.

### P1 — High impact, shared UI

5. **Navigation current page** — `Layout.tsx`: nav links missing `aria-current="page"` for active route.
6. **Skip link / main landmark** — No skip link; `main` existed but no `id` for skip target.
7. **Focus visibility** — Global CSS did not define a consistent `:focus-visible` ring (relying on browser defaults only).
8. **Global motion** — `index.css`: universal `transition` on `*` conflicts with reduced-motion expectations.

### P2 — Route-level / content

9. **Login status messages** — Errors/success not in a live region for SR announcement.
10. **Help Center** — Search field used `aria-label` only; improved with visible + screen-reader labeling pattern and live regions for loading/errors where applicable.
11. **Menu tabs** — Tab buttons missing `id` / `aria-controls` / `tabpanel` wiring for robust SR support.
12. **Support queue** — Load and action errors benefit from `role="alert"` / live announcement.

## Remediation status

Shared shell (`index.css`, `Layout.tsx`), shared `Dialog` portal + `#root` isolation (`components/a11y/Dialog.tsx`), dialogs (`RunDashboardModals.tsx`, Settings outlier flow, Help Center escalation), calendar (`RunCalendar.tsx`), chat (`Chat.tsx`), login (`Login.tsx`), menu chart tabs (arrow/home/end on `tablist`), charts (keyboard-operable points, `aria-describedby` text summaries, inclusive copy), History filter disclosure (`aria-controls`, live region wiring), Help Center and Support Queue (labels/live regions, `aria-pressed` on queue selection), and this document — implemented in-repo as of **Last updated**.

### Automated verification

- `src/components/a11y/Dialog.test.tsx` — root `aria-hidden` / `inert` while open, dialog role + name, Escape closes.
- Full web unit/integration suite: `pnpm test` from `products/Kinetix/apps/web` (includes Help Center escalation and Support Queue integration tests).

## Approved exceptions

None. Revisit if new routes or heavy custom widgets ship without shared primitives.
