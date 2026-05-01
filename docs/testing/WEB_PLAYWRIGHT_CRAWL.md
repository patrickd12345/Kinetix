# Web Crawl with Playwright

Automated "user-evidence crawl" of the **Kinetix web app**, modeled after the
iOS Maestro workflow. The goal is to make web UI verification feel less like a
selector-only test suite and more like a repeatable manual QA pass with
artifacts another agent can inspect.

This is the web UI evidence path referenced from
[`docs/AGENT_BOOTSTRAP.md`](../AGENT_BOOTSTRAP.md) and governed by umbrella
[`docs/standards/06-testing-and-verification.md`](../../../../docs/standards/06-testing-and-verification.md).

## What it does

1. Starts from the Kinetix product root.
2. Runs the named crawl command:

   ```bash
   pnpm test:crawl
   ```

3. Executes [`apps/web/e2e/kinetix-audit-crawl.spec.ts`](../../apps/web/e2e/kinetix-audit-crawl.spec.ts).
4. Uses [`apps/web/playwright.config.ts`](../../apps/web/playwright.config.ts), which:
   - starts the Vite web server for local/CI runs
   - sets `VITE_SKIP_AUTH=1` and `VITE_MASTER_ACCESS=1` for deterministic shell coverage
   - supports `PW_TRACE=on` and `PW_VIDEO=1` for evidence-heavy CI runs
5. Runs serially (`--workers=1 --retries=0`) so artifacts reflect a single user
   journey and avoid multi-worker browser pressure on local agents.
6. Captures:
   - named route screenshots via `testInfo.outputPath(...)`
   - Playwright HTML report
   - traces, videos, and failure screenshots when enabled
   - console warning/error attachments from the crawl spec

## Why this exists

The iOS Maestro crawl feels strong because it leaves visible proof: build,
install, launch, tap, screenshot, logs. Web can get close when Playwright is
used the same way:

- fresh browser context
- deterministic app state
- top-level navigation and route crawl
- named screenshots for every major surface
- traces/videos/logs uploaded as artifacts
- explicit report of what was fixed versus what is still blocked

This does **not** replace focused Vitest/unit tests or deeper E2E specs. It is
the first evidence pass for user-facing UI claims.

## Running

### Local / agent run

From `products/Kinetix`:

```bash
pnpm test:crawl
```

**Higher-risk interaction pass** (chat API + UI gate, settings toggles, charts desktop/mobile, operator + support queue mocks, help search flow):

```bash
pnpm test:crawl:hard
```

To force full evidence output locally:

```bash
PW_TRACE=on PW_VIDEO=1 pnpm test:crawl
```

On Windows PowerShell:

```powershell
$env:PW_TRACE = "on"; $env:PW_VIDEO = "1"; pnpm test:crawl
```

Artifacts are written under:

- `apps/web/test-results/`
- `apps/web/playwright-report/`

Both paths are ignored by git.

### Troubleshooting

If Playwright reports **`http://127.0.0.1:5173 is already used`**, something else
is bound to the Vite port. Either stop that process or reuse it:

```powershell
$env:PW_REUSE_SERVER = "1"; pnpm test:crawl
```

(`reuseExistingServer` is already supported in `playwright.config.ts` when
`PW_REUSE_SERVER=1`.)

### In CI

The workflow is [`.github/workflows/web-crawl.yml`](../../.github/workflows/web-crawl.yml).

It triggers on:

- `workflow_dispatch`
- `push` to branches matching `web-crawl/**`

Manual trigger:

```powershell
gh workflow run "Web Crawl (Playwright)" --ref web-crawl/initial-pass
```

Download artifacts:

```powershell
gh run list --workflow "Web Crawl (Playwright)" --limit 5
gh run download <RUN_ID> --dir crawl-artifacts
```

The downloaded folder contains:

- `web-crawl-playwright-report-<run_id>/`
- `web-crawl-test-results-<run_id>/`

## Current crawl scope

The crawl currently covers:

- route loading for the public/protected shell routes in `src/App.tsx`
- per-route screenshots
- axe accessibility summaries
- console warnings/errors as attachments
- primary navigation visibility and login-redirect guard

The existing spec is intentionally broad and visual. Add narrower specs when a
bug needs a precise interaction proof.

## When to use this

Use this crawl before claiming completion for:

- display/layout defects
- blank or broken screens
- navigation regressions
- route shell failures
- responsive UI changes
- accessibility-oriented visual changes
- agent reports that say "I checked the web app like a user"

For API-only, auth-only, billing-only, or database-only fixes, run the relevant
unit/integration/contract checks too. Screenshots alone are not enough when the
claim depends on backend state or external systems.

## Related

- [`IOS_MAESTRO_CRAWL.md`](IOS_MAESTRO_CRAWL.md) — native iOS equivalent.
- [`docs/AGENT_BOOTSTRAP.md`](../AGENT_BOOTSTRAP.md) — product-local evidence paths.
- [`../../../../docs/standards/06-testing-and-verification.md`](../../../../docs/standards/06-testing-and-verification.md) — umbrella testing standard.
