# Kinetix Native Audit Runbook (iOS / watchOS)

**Purpose:** Repeatable manual verification when native code or watch/iOS parity changes, until automated Xcode UI tests and CI are wired.

**Scope:** `ios/KinetixPhone` and `watchos/KinetixWatch` (see root `README.md` / `REPO_STATUS.md`). Web Playwright audit harness does not cover native shells.

## Preconditions

- Xcode current stable on a Mac with simulators or devices.
- Same Bookiji platform profile / Supabase auth as web when testing signed-in flows.
- Release or RC build configuration matches what ships (no debug-only toggles).

## Critical flows (minimum)

1. **Watch — start / pause / resume** a run; verify live metrics and return to shell without crash.
2. **Watch — sync** to phone / health pipeline if applicable; confirm no duplicate sessions after relaunch.
3. **Phone — open dashboard** from complications or app icon; verify navigation to key screens matches [`docs/IOS_WATCH_PARITY_MATRIX.md`](../IOS_WATCH_PARITY_MATRIX.md) expectations.
4. **Settings / diagnostics** (if exposed): confirm self-test or logging hooks do not leak secrets.

## Evidence to capture

- Short screen recording or screenshot set per flow.
- Xcode / device logs for any crash or sync failure (redact tokens).
- Note build number, iOS/watchOS versions, and whether network was cellular vs Wi‑Fi.

## Cadence

- Before promoting an RC that touches `ios/**` or `watchos/**`.
- After dependency bumps (SwiftPM, watchOS SDK).

## Automation follow-ups (not blocking this runbook)

- Xcode UI tests and/or screenshot baselines for critical flows.
- GitHub Actions on `macos-latest` with signing secrets (see `.github/workflows/native-ci-placeholder.yml`).

**Last updated:** 2026-04-11
