# Kinetix staging smoke — KX-FEAT-004

**Status:** Transitional  
**Feature:** KX-FEAT-004 Infisical canonical secrets pilot  
**Staging URL:** TBD - set the actual staging URL before use  
**Commit/tag tested:** TBD at execution time  
**Last updated:** 2026-04-18

## Purpose

Manual smoke checklist for validating that a staging-grade Kinetix deployment is using the expected environment source, authenticates against the shared Bookiji Supabase project, and still passes the core user flows after the Infisical pilot rollout.

## Infisical env-source status

| Item | Current expectation |
|------|---------------------|
| Canonical source of truth | **Infisical** (`/platform` + `/kinetix`) |
| Staging envs currently synced from Infisical | **Target state:** yes |
| Staging envs currently manual in Vercel/GitHub | **Possible transitional fallback:** yes, until sync is completed and audited |
| Current state classification | **Transitional** until sync is proven, documented, and repeatable |

If staging is still running on manually configured Vercel or GitHub environment variables, record that explicitly and treat the run as **transitional**, not final compliance.

## Preconditions

- [ ] The commit or release candidate being tested is recorded in **Commit/tag tested**
- [ ] Required client envs resolve (`VITE_SUPABASE_URL` and anon/publishable key equivalent)
- [ ] Required server envs resolve for any enabled server-only features
- [ ] Staging deployment owner confirms whether envs came from Infisical sync or manual maintenance
- [ ] No secrets are copied into notes, screenshots, tickets, or logs

## Compliance status rubric

| Status | Meaning |
|--------|---------|
| **Compliant** | Staging envs are synced from Infisical using the approved path mapping and no required value is maintained manually outside the canonical flow except documented short-term fallback. |
| **Transitional** | Some or all staging envs are still maintained manually in Vercel/GitHub while the pilot is being adopted. This is allowed only with explicit documentation and rollback clarity. |
| **Blocked** | Required envs are missing, stale, inconsistent, or unverifiable; the smoke run cannot establish deployment correctness. |

## Authentication and access requirements

- [ ] Real auth flow is used; do not treat local-only shortcuts as staging proof
- [ ] `VITE_SKIP_AUTH` is **not** set
- [ ] `VITE_MASTER_ACCESS` is **not** set
- [ ] Supabase redirect allowlist includes the staging URL and callback path
- [ ] Supabase anon/public env is present and matches the intended shared project
- [ ] User account has the required **`kinetix`** entitlement before gating-sensitive checks

## Billing and entitlement requirements

- [ ] If billing is enabled for this environment, Stripe-related envs are present and the billing path does not error on startup
- [ ] Entitlement checks succeed for an allowed user
- [ ] Entitlement denial still behaves correctly for a user without access

## Core smoke checklist

### 1. Sign-in and shell

- [ ] Load the staging site using the recorded staging URL
- [ ] Sign in with a real allowed account
- [ ] Confirm the app lands in the expected authenticated shell
- [ ] Confirm no obvious environment mismatch error appears on startup

### 2. Dashboard / history / KPS

- [ ] Dashboard loads
- [ ] History page loads
- [ ] KPS-related data or messaging loads without blank/fatal error
- [ ] No obvious Supabase client misconfiguration appears in the browser console

### 3. Support / help

- [ ] `/help` loads in staging
- [ ] Help Center primary response path works or shows the documented safe fallback
- [ ] If operator/support surfaces are enabled, authenticated support queue and related flows load without environment errors

### 4. Env-source validation

- [ ] Operator records whether staging envs were synced from Infisical
- [ ] Operator records whether any values are still maintained manually in Vercel/GitHub
- [ ] If manual maintenance exists, operator lists which system still requires manual upkeep and why
- [ ] Operator confirms the state is labeled **Compliant**, **Transitional**, or **Blocked**

## Rollback note

If the staging deployment fails because of environment drift after the Infisical pilot changes:

1. restore the last known good staging environment mapping
2. document whether the failure came from Infisical data, sync configuration, or manual staging drift
3. do not promote the same environment setup to production until the source of truth and sync path are verified

## Pass/fail summary

| Area | Pass | Fail | Notes |
|------|------|------|-------|
| Env-source status recorded | [ ] | [ ] | |
| Auth works with real user | [ ] | [ ] | |
| Redirect allowlist correct | [ ] | [ ] | |
| Supabase anon/public env present | [ ] | [ ] | |
| Entitlement requirement satisfied | [ ] | [ ] | |
| Billing path acceptable for environment | [ ] | [ ] | |
| Dashboard/history/KPS smoke | [ ] | [ ] | |
| Support/help smoke | [ ] | [ ] | |
| Overall status | [ ] | [ ] | Compliant / Transitional / Blocked |

## Execution notes

- Record the exact staging URL used.
- Record the tested commit SHA or tag.
- Record whether the run was blocked by missing env configuration, missing entitlement, or missing sync setup.
- Do not mark the pilot complete until the environment source is provably reachable from Infisical or an explicitly documented transitional fallback is approved.
