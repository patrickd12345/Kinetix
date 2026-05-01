# iOS Crawl with Maestro

Automated "user crawl" of the **KinetixPhone** iOS app. This is the closest
practical equivalent to Playwright for native iOS: YAML flows, per-step
screenshots, JUnit output, and CI-friendly runs.

## Platform constraint (agents on Windows / Linux)

**iOS Simulator and Xcode run only on macOS.** A Cursor session on Windows cannot
spin up an iPhone Simulator or drive Maestro against a local `.app` the way
Playwright drives Chromium. Realistic options:

| Situation | Where the Simulator runs | Typical tool |
| --- | --- | --- |
| Mac available | Local Mac | Maestro CLI or XCUITest |
| No Mac, GitHub access | GitHub Actions `macos-*` | Maestro in CI (**this doc**) |
| Real devices required | Device farm (BrowserStack, Sauce, AWS Device Farm) | Farm tooling + `.ipa` |

This repo implements the **CI path**:
[`.github/workflows/ios-crawl.yml`](../../.github/workflows/ios-crawl.yml) runs on
**`macos-15`** so contributors still get screenshots, logs, and JUnit without a
local Mac.

### Why `macos-15` (Swift 6.1 / swift-crypto)

SPM resolution can pull **swift-crypto** `>= 4.5.0` (for example via Supabase),
which requires **Swift 6.1**. On **`macos-14`**, `setup-xcode` with
`latest-stable` has resolved to **Xcode 16.2 (Swift 6.0)**, which fails during
**dependency resolution** before `xcodebuild` produces an `.app`. **`macos-15`**
images ship **Xcode 16.3+ (Swift 6.1)** by default, which unblocks the build.

**Related:** [`.github/workflows/native-ci.yml`](../../.github/workflows/native-ci.yml)
also runs on **`macos-15`** with the same Swift 6.1 baseline as this crawl (see
that workflow file for the current runner image).

### Tooling orientation (Playwright vs Maestro vs XCUITest)

| | Playwright (web) | Maestro (this crawl) | XCUITest |
| --- | --- | --- | --- |
| Authoring | TS/JS | YAML flows | Swift |
| Local on Windows | Yes | No (needs macOS Simulator) | No |
| "Crawl" / smoke | Natural fit | Natural fit (`takeScreenshot`, tab walks) | Heavier setup |
| CI runner | Linux / any | **macOS** | **macOS** |

### Why this can feel stronger than the web Playwright loop

This workflow is not automatically "better because Apple"; it feels better
because the evidence loop is tighter for this specific product:

- **The app surface is finite.** `MainTabView` has five top-level tabs, so a
  crawl can quickly cover the real navigation spine: Home, Coach, Build,
  History, and Settings. Web apps often have more routing states, responsive
  breakpoints, auth states, ads/scripts, and browser differences.
- **The simulator is a single controlled device.** A named iPhone Simulator,
  clean install, fixed permissions, and fresh app state make the screenshots
  easier to trust. Web Playwright often has to manage browser storage, server
  boot timing, network mocks, viewport variance, and hydration timing.
- **Maestro reads like a user checklist.** `tapOn`, `assertVisible`,
  `takeScreenshot`, and YAML flow names map directly to manual QA language.
  That makes failures easier to explain in chat and easier to turn into fixes.
- **Artifacts are naturally visual.** The crawl uploads step screenshots,
  JUnit, simulator logs, and build logs every run. That gives agents something
  concrete to inspect even from Windows.
- **Native bugs are closer to the user.** Accessibility exposure, tab
  automation, SwiftData launch crashes, HealthKit prompts, and Simulator driver
  startup are app/runtime realities. The crawl finds integration bugs unit tests
  and static review miss.

The strategy for future agents: use Maestro as a **native user evidence loop**,
not as a replacement for Swift unit tests or TestFlight. A fix is convincing
when the app builds, installs, launches, runs the relevant flow, and leaves
screenshots/logs that match the claim.

This is the iOS UI evidence path referenced from
[`docs/AGENT_BOOTSTRAP.md`](../AGENT_BOOTSTRAP.md).

## What it does

1. `xcodegen` generates the Xcode project from
   [`watchos/project.yml`](../../watchos/project.yml).
2. `xcodebuild` builds the `KinetixPhone` scheme for an iPhone Simulator
   (`platform=iOS Simulator,name=iPhone 15`) with `CODE_SIGNING_ALLOWED=NO`.
3. A dedicated simulator (`Kinetix Crawl Sim`) is created/erased/booted so the
   crawl always starts from a clean state.
4. The built `.app` is installed via `xcrun simctl install`.
5. Maestro runs the YAML flows under [`.maestro/flows/`](../../.maestro/flows/)
   against that simulator, producing:
   - per-step screenshots in `.maestro/screenshots/`
   - a JUnit report at `reports/maestro/junit.xml`
   - a Maestro debug bundle at `reports/maestro/debug/`
   - a filtered simulator log at `reports/simulator.log`
6. The CI workflow uploads all of the above as artifacts (and an `xcresult`
   bundle on failure).

## Flow inventory

All flows live under [`.maestro/flows/`](../../.maestro/flows/):

| File | Purpose |
| --- | --- |
| `00-launch.yml` | Cold launch, assert main tabs are present, screenshot home. |
| `10-tabs-smoke.yml` | Visit Home / Coach / Build / History / Settings, screenshot each. |
| `20-settings-drilldown.yml` | Open Settings and scroll through every section, screenshot. |
| `30-builder.yml` | Open Build, tap the seeded `Live Coach` template, screenshot the editor. Does NOT start a run. |
| `40-history-empty.yml` | Open History on a fresh simulator and confirm the `No Runs Yet` empty state renders. |

Reusable helper:
[`.maestro/helpers/dismiss-system-alerts.yml`](../../.maestro/helpers/dismiss-system-alerts.yml)
silently dismisses any iOS system alert (Allow / Don't Allow / OK / Continue /
Not Now). Each flow runs it after launch and after every navigation step so a
stray Health/Notifications/Tracking prompt cannot hang the crawl.

Best-effort exploration:
[`.maestro/exploration/crawl.yml`](../../.maestro/exploration/crawl.yml) loops
through the tabs five times scrolling each surface. It is **non-blocking** and
only runs when explicitly enabled (see "Running" below).

## Running

### In CI (the normal path)

The workflow is [`.github/workflows/ios-crawl.yml`](../../.github/workflows/ios-crawl.yml).

It triggers on:

- `workflow_dispatch` — fire it manually from GitHub or the `gh` CLI.
- `push` to any branch matching `ios-crawl/**`.

Manual trigger from a Windows shell:

```powershell
gh workflow run "iOS Crawl (Maestro)" --ref ios-crawl/initial-pass
```

To also include the exploratory crawl:

```powershell
gh workflow run "iOS Crawl (Maestro)" --ref ios-crawl/initial-pass -f run_exploration=true
```

Download artifacts after the run completes:

```powershell
gh run list --workflow "iOS Crawl (Maestro)" --limit 5
gh run download <RUN_ID> --dir crawl-artifacts
```

The `crawl-artifacts/` folder will contain:

- `maestro-screenshots-<run_id>/` — every `takeScreenshot` PNG plus Maestro's
  per-step `debug/` snapshots.
- `maestro-reports-<run_id>/` — `junit.xml`, `xcodebuild.log`, `simulator.log`.
- `ios-crawl-xcresults-<run_id>/` — only present when the run failed.

### Locally on a Mac dev box

Prereqs: Xcode + iOS Simulator runtime, Homebrew with `xcodegen`, `xcbeautify`,
and Maestro on `PATH`.

```bash
brew install xcodegen xcbeautify
curl -Ls "https://get.maestro.mobile.dev" | bash
export PATH="$HOME/.maestro/bin:$PATH"

bash scripts/ios-maestro/build-and-run.sh
```

Useful overrides (all env vars):

| Var | Default | Notes |
| --- | --- | --- |
| `SIM_DEVICE` | `iPhone 15` | Any installed `xcrun simctl list devicetypes` name. |
| `SIM_NAME` | `Kinetix Crawl Sim` | Dedicated simulator name; created if missing. |
| `SCHEME` | `KinetixPhone` | Xcode scheme to build. |
| `CONFIG` | `Debug` | Xcode configuration. |
| `RUN_EXPLORATION` | `0` | Set to `1` to also run the exploratory crawl. |

To re-run a single flow (much faster than rebuilding):

```bash
maestro test .maestro/flows/10-tabs-smoke.yml
```

## What this v1 deliberately does NOT cover

- **Authenticated flows.** No Supabase login, Strava/Withings OAuth, or Stripe
  entitlement scenarios. The KinetixPhone `MainTabView` renders all five tabs
  immediately at launch (auth bootstrap happens in the background — see
  [`ios/KinetixPhone/MainTabView.swift`](../../ios/KinetixPhone/MainTabView.swift)),
  so the crawl can produce useful coverage with zero credentials. Adding
  authenticated flows means provisioning a dedicated `kinetix-ci@bookiji.dev`
  Supabase account, storing the credentials in Infisical under `/kinetix`, and
  wiring them through the workflow as encrypted env (per
  [umbrella `AGENTS.md`](../../../../AGENTS.md) and
  [`.cursor/rules/infisical-cli-default-for-agents.mdc`](../../../../.cursor/rules/infisical-cli-default-for-agents.mdc)).
- **Watch app.** The watch already has `KinetixHostUITests`; this crawl does
  not touch it.
- **Real-device farm.** The same `.app` and Maestro flows can be uploaded to
  BrowserStack / Sauce / AWS Device Farm later.
- **Pixel-diff visual regression.** v1 captures screenshots; pixel baselines
  come after the flows are stable.

## Known sharp edges

- **HealthKit on Simulator.** The KinetixPhone target declares the HealthKit
  capability ([`watchos/project.yml`](../../watchos/project.yml) lines 62-68).
  Simulator support is partial. The current flows avoid surfaces that request
  Health authorization; if a flow ever does, the
  `dismiss-system-alerts.yml` helper will tap "Don't Allow" rather than hang.
- **`SwiftData` migrations.** A schema mismatch in the
  `modelContainer` declared in
  [`ios/KinetixPhone/KinetixPhoneApp.swift`](../../ios/KinetixPhone/KinetixPhoneApp.swift)
  crashes the app at launch. The `00-launch` flow will fail loudly in that
  case; triage from `reports/simulator.log`.
- **Network calls during `MainTabView.onAppear`.** `AuthService.bootstrap()`
  and `EntitlementService.refresh()` fire on every appear. They are
  best-effort and do not block UI, but failures will show up in
  `reports/simulator.log`.
- **Cache key collision.** The CI cache key is namespaced
  (`ios-crawl-`) so it does not collide with `native-ci.yml`.
- **Maestro XCTest driver timeout on cold Simulator.** After `simctl install`,
  SpringBoard may still be settling; Maestro can fail with
  `IOSDriverTimeoutException` / `iOS driver not ready in time`. The crawl script
  waits **`MAESTRO_SIM_STABILIZE_SECONDS`** (default 30s) and sets
  **`MAESTRO_DRIVER_STARTUP_TIMEOUT`** (default 180000ms). Override in CI via
  [`.github/workflows/ios-crawl.yml`](../../.github/workflows/ios-crawl.yml)
  `env` if runners get slower.
- **Tab bar automation.** SwiftUI classic `.tabItem { Label }` + identifiers on
  tab *content* did not surface on the tab *bar* for Maestro. [`MainTabView`](../../ios/KinetixPhone/MainTabView.swift)
  uses the iOS 18 **`Tab` / `TabView(selection:)`** API so each bar item can carry
  **`accessibilityIdentifier`** `KinetixTab.home`, `.coach`, `.build`, `.history`,
  and `.settings`; flows tap and assert with `id:`.

## When a flow fails

1. Open the failing screenshot from
   `maestro-screenshots-<run_id>/<flow-name>-*.png`.
2. Open `maestro-reports-<run_id>/junit.xml` for the failing assertion line.
3. Open `maestro-reports-<run_id>/simulator.log` for the iOS log around the
   failure timestamp.
4. If the build itself failed, open
   `maestro-reports-<run_id>/xcodebuild.log`; on a deeper test crash, look
   under `ios-crawl-xcresults-<run_id>/`.

## Related

- [`docs/AGENT_BOOTSTRAP.md`](../AGENT_BOOTSTRAP.md)
- [`.github/workflows/native-ci.yml`](../../.github/workflows/native-ci.yml) —
  builds + watch UI tests; complementary, not replaced.
- [`AGENTS.md`](../../AGENTS.md) — Kinetix testing contract.
