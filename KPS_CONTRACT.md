# KPS Contract (Non-Negotiable)

This document defines KPS behavior that must not drift.

## Canonical semantic (absolute score)

**KPS is a distance-, age-, and weight-adjusted personal performance score.**

Computation order for **absolute** KPS (see `calculateKPS` in `packages/core/src/kps/calculator.ts`):

1. **Distance normalization (Riegel)**: map the run to an equivalent time at the reference distance (default 10 km).
2. **Normalized pace basis**: equivalent seconds per km at that reference distance.
3. **Age factor**: heuristic post-peak linear adjustment (not a named physiology law).
4. **Weight factor**: heuristic linear adjustment vs reference mass (70 kg); heavier increases effective pace (does not inflate score vs reference weight).
5. **Final score**: pace inverted to speed and scaled for display.

**Display KPS** in the product is still **PB-relative** (see Core Invariants below): the absolute score above is the input to the ratio vs the PB run.

### Heuristics (tunable, not Riegel-class laws)

- Age and weight models are simplified fairness adjustments. They may be retuned; Riegel distance normalization is the fixed structural choice.
- Native iOS/watch **NPI** helpers may differ from this web/core pipeline until explicitly aligned (see `RunMetricsCalculator`).

## Core Invariants

1. KPS is always age-weight graded.
2. Lifetime PB is always `100`.
3. Every non-PB displayed KPS is a ratio of PB:

```
relativeKPS = (absoluteKPS(run) / absoluteKPS(pbRun)) * 100
```

## Canonical Functions

- Absolute KPS (age-weight + Riegel): `calculateKPS` in `packages/core/src/kps/calculator.ts`
- Web absolute wrapper: `calculateAbsoluteKPS` in `apps/web/src/lib/kpsUtils.ts`
- Display KPS (PB-relative): `calculateRelativeKPS` and `calculateRelativeKPSSync` in `apps/web/src/lib/kpsUtils.ts`

## Required Data Inputs

- Use `getProfileForRun(run)` or `getProfileForRunDate(run.date)` so run-time weight is correct.
- PB context comes from `getPB()` + `getPBRun()`.
- Before any user-facing KPS display, ensure PB exists via `ensurePBInitialized(currentProfile)`.

## Forbidden Patterns

- Using `run.kps` for user-facing display, ranking, charting, or PB comparison.
- Falling back from relative KPS to absolute KPS in display paths.
- Recomputing PB by scanning runs in display code.

## Persistence Rule

- Run records store facts (`distance`, `duration`, `date`, `weightKg`, etc.).
- KPS is computed dynamically; it is not authoritative stored state.
- Legacy local `run.kps` values are removed by DB migration and ignored by runtime logic.

## Practical Rule for Future Agents

If a UI feature shows a KPS number:

1. Get run profile with age + weight.
2. Compute relative KPS via `calculateRelativeKPS` or `calculateRelativeKPSSync`.
3. Never display cached `run.kps`.

