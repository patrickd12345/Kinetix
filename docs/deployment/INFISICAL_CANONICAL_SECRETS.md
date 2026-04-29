# KX-FEAT-004 — Infisical canonical secrets pilot

**Status:** Pilot proposal for Kinetix  
**Scope:** Kinetix local development, Vercel deployment sync, and GitHub Actions secret delivery  
**See also:** [`INFISICAL_LOCAL_DEV.md`](./INFISICAL_LOCAL_DEV.md), [`ENV_PARITY.md`](./ENV_PARITY.md), workspace [`docs/platform/secret-management.md`](../../../../docs/platform/secret-management.md)

## Canonical source-of-truth policy

For Kinetix, **Infisical is the canonical source of truth** for durable secrets.

That means:

- secret values are authored and rotated in Infisical first
- Vercel and GitHub should receive synchronized copies or short-lived access derived from Infisical
- committed repo files, ad-hoc CI variables, and local `.env.local` files are **not** canonical
- production deployments should have an explicit validation gate for required environment variables and should avoid silently falling back to stale or ad-hoc configuration

This pilot is intentionally conservative: it documents the operating model before broader rollout to other Bookiji Inc products.

## Environment naming

Kinetix follows the existing Bookiji Inc Infisical environment model:

| Infisical env | Kinetix runtime target |
|---------------|------------------------|
| `dev` | local development, preview deploys, non-production CI |
| `prod` | production deploys only |

**Rule:** local and preview use **`dev`**. Production uses **`prod`**.

## Path structure

Kinetix reads secrets from two folders:

| Path | Ownership | Examples |
|------|-----------|----------|
| **`/platform`** | shared Bookiji platform | Supabase URL, anon/publishable key, platform-wide server credentials |
| **`/kinetix`** | Kinetix-specific | Strava, Withings, Gemini, billing, AdSense public client/slot (`VITE_ADSENSE_*`), and Kinetix-only overrides |

Resolution order:

```text
/platform -> /kinetix -> local emergency override
```

Kinetix-specific values win over shared defaults when the same key name exists in both paths.

## Local flow

Local development uses documented pull-and-validate commands:

```bash
pnpm dev
pnpm dev:infisical
pnpm verify:infisical
```

Expected behavior:

1. resolve the Infisical project
2. export `/platform` and `/kinetix`
3. merge without printing secret values
4. validate required variables
5. fail before startup if required values are missing in the Infisical-driven local workflow

`.env.local` is allowed only as an emergency local fallback for explicit non-Infisical local startup paths such as `pnpm dev:raw` and must not become the durable source of truth.

## Vercel Secret Sync target

**Target:** the Vercel project named **`kinetix`** should receive environment values sourced from Infisical.

Preferred operating model:

1. Infisical `dev` syncs to Vercel **Preview**
2. Infisical `prod` syncs to Vercel **Production**
3. required public client variables remain explicitly present in Vercel envs
4. server-only secrets stay server-only and must never be exposed as `VITE_*` or `NEXT_PUBLIC_*`

Kinetix Production uses the official Infisical Vercel Secret Sync **`kinetix-prod-kinetix-to-vercel-production`** for Infisical `prod` `/kinetix` -> Vercel Production. Deletion is disabled so the sync does not remove unrelated legacy/manual Vercel variables. Preview/Development syncs are intentionally not configured until their callback/base URL policy is chosen.

This pilot does **not** introduce a custom sync script. Use the official Infisical integration or manual operator sync.

## GitHub Actions OIDC target

**Preferred CI target:** GitHub Actions should authenticate to Infisical using **GitHub Actions OIDC** and retrieve short-lived access rather than storing long-lived Infisical machine secrets in GitHub.

Recommended policy:

- repository workflows request the minimum Infisical scope needed
- preview or test workflows use `dev`
- production workflows use `prod` only on protected branches/environments
- OIDC trust is restricted to the Kinetix repository and intended workflows

## GitHub Secret Sync fallback

If OIDC is not yet configured, a transitional fallback is acceptable:

- sync only the minimum required non-secret metadata or short-lived bootstrap values into GitHub
- keep durable secret truth in Infisical
- document every GitHub secret that is still manually maintained
- remove the fallback once OIDC is operational

**Transitional rule:** manual GitHub env maintenance may continue briefly, but it is not considered the canonical state.

## Approval workflow recommendation

For production-impacting secret changes:

1. operator prepares the change in Infisical
2. another reviewer confirms path, environment, and blast radius
3. sync or rollout occurs in the intended target only
4. operator performs a post-sync verification (`pnpm verify:infisical`, deployment health checks, or CI validation)

For especially sensitive keys, use a two-person review before changing `prod`.

## Audit log expectation

The pilot assumes:

- Infisical audit logs show who changed which secret and when
- Vercel or GitHub history can show when sync or deployment occurred
- Kinetix runtime and helper scripts log only safe metadata such as environment labels, path names, and missing variable names

Secret values must never appear in logs, tickets, screenshots, or PR comments.

## Dynamic secrets candidates

Potential future candidates for stronger controls:

- ephemeral database access where compatible with platform architecture
- short-lived CI access tokens obtained through OIDC
- temporary integration credentials used only during deployments or operator workflows

This pilot does **not** require immediate migration to dynamic secrets. It identifies them as follow-up opportunities.

## Migration checklist from manual Vercel and GitHub env maintenance

- [ ] inventory current Kinetix secrets by owner and target
- [ ] confirm each key belongs in `/platform` or `/kinetix`
- [ ] copy existing values into Infisical without rotating production by default
- [ ] map `dev` to Preview and `prod` to Production
- [ ] verify required public client variables remain available to the Vite web app
- [ ] verify server-only secrets are not exposed through `VITE_*` or `NEXT_PUBLIC_*`
- [ ] document any GitHub workflow still using manual secrets
- [ ] enable OIDC when feasible
- [ ] remove redundant manual Vercel/GitHub maintenance once sync is stable

## Rollback plan

If the pilot causes deployment or CI instability:

1. stop changing secret values
2. revert the sync target to the last known-good Vercel or GitHub environment configuration
3. keep Infisical values intact for auditability
4. document the mismatch and reason for rollback
5. fix mapping, path ownership, or validation gaps before re-enabling sync

Rollback should restore the previous working environment state without introducing ad-hoc undocumented secrets.

## Non-goals

This pilot does **not**:

- require Infisical at browser runtime
- permit the browser to fetch secrets directly
- replace deployment-time validation with best-effort behavior
- introduce a fragile custom Vercel secret sync implementation
- require normal lint, build, or test commands to talk to Infisical
- rotate live production secrets merely to complete documentation rollout

## Manual setup checklist for the human operator

### In Infisical

1. Confirm the **Bookiji Inc** project exists.
2. Confirm environments **`dev`** and **`prod`** exist.
3. Confirm folders **`/platform`** and **`/kinetix`** exist.
4. Move or copy Kinetix secrets into the correct folder.
5. Confirm required client values exist for the appropriate environment.
6. Confirm prod-only values are not mistakenly stored only in `dev`.
7. Enable audit logging and ensure appropriate operator access controls.

### In Vercel

1. Open the **`kinetix`** project.
2. Confirm Preview should map to Infisical `dev`.
3. Confirm Production should map to Infisical `prod`.
4. Use the official Infisical integration if available, or manually sync values from Infisical.
5. Confirm public client values are present under the names Kinetix actually resolves.
6. Confirm server-only values are not exposed as browser-public vars.
7. Redeploy the intended environment and run smoke checks.

### In GitHub

1. Review which workflows actually need secrets.
2. Prefer configuring **OIDC trust** from GitHub Actions to Infisical.
3. If OIDC is not ready, document every GitHub secret kept as fallback.
4. Scope fallback secrets to the minimum needed workflows and environments.
5. Remove redundant long-lived GitHub secrets after OIDC or Infisical sync is proven stable.
