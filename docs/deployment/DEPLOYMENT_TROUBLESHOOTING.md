# Kinetix deployment troubleshooting

Use **patrickd12345/Kinetix** and the **kinetix** Vercel project.

If Kinetix (Vercel) has not deployed since a certain date, check the following.

## 1. Vercel dashboard

- Open the [Vercel dashboard](https://vercel.com/dashboard) and the **Kinetix** project.
- **Deployments**: See if recent commits triggered builds. If there are no new deployments, either no pushes reached the connected branch or the Git integration is disconnected.
- **Failed builds**: If deployments appear but show "Error" or "Failed", open the build log. Common causes:
  - Missing or wrong env vars (e.g. Supabase, Stripe).
  - `pnpm install` or `pnpm run build` failing (e.g. Node/pnpm version, lockfile mismatch).
  - `outputDirectory` in `vercel.json` does not match the actual build output (e.g. `apps/web/dist`).
  - **"Unsupported environment (bad pnpm and/or Node.js version)"**: The repo requires Node 22.x and pnpm >= 8. `vercel.json` uses `corepack enable pnpm` before install so Vercel uses the version from `package.json` → `packageManager`. If it still fails, set in Vercel → Settings → Environment Variables (Build): `ENABLE_EXPERIMENTAL_COREPACK=1`.

## 2. Branch and Git connection (auto-deploy on push)

Deployment is triggered automatically when you push to the **production branch** only if the project is connected to Git in Vercel.

**Check that auto-deploy is enabled:**

1. **Vercel** → **Kinetix** project → **Settings** → **Git**.
2. Confirm **Connected Git Repository** shows your repo (e.g. `patrickd12345/Kinetix` or your org/repo). If it says "No Git repository connected", connect it (Connect Git Repository).
3. Note the **Production Branch** (e.g. `main`). Only pushes to this branch create production deployments and update kinetix.bookiji.com; other branches get preview URLs only.
4. **Quick test:** From the repo run `git push origin main` (or your production branch) with a small commit (e.g. a doc edit). Within a couple of minutes, **Deployments** should list a new deployment for that commit. If nothing appears, Git integration is missing or the push was to a different branch.

### Check via CLI / script (no dashboard)

From the repo root, run:

```bash
node scripts/vercel-project-git-check.mjs
```

Uses your Vercel CLI login (after `vercel login`) or `VERCEL_TOKEN`. Prints whether Git is connected, the repo (e.g. `org/repo`), and the production branch. No dashboard needed.

Optional: `vercel project inspect kinetix` (project id, root dir, Node version) and `vercel list kinetix` (recent deployments).

## 3. CI workflow (GitHub Actions)

- The **Web CI** workflow (`.github/workflows/web-ci.yml`) runs on changes to `apps/web/**`, `packages/core/**`, and root config. It does **not** deploy; it only runs tests and build.
- If Vercel is set to "Deploy only when the GitHub check passes", then a failing or not-running CI can block deploys. As of the workflow fix (paths updated from `web/**` to `apps/web/**`), CI should run on relevant pushes. Check the **Actions** tab on GitHub for the Kinetix repo.

## 4. Local checks before pushing

From the repo root:

```bash
pnpm install
pnpm test
pnpm run build
```

If these fail locally, Vercel will usually fail too. Fix locally then push.

## 5. Summary checklist

| Check | Where |
|-------|--------|
| Auto-deploy on push (Git connected, production branch) | Vercel → Settings → Git |
| Recent deployments for your branch | Vercel → Project → Deployments |
| Build error logs | Vercel → Click a failed deployment → Build log |
| Production branch name | Vercel → Settings → Git |
| Pushes to that branch | `git log origin/main` (or your prod branch) |
| CI running and passing | GitHub → Actions → Web CI |
| Env vars set | Vercel → Settings → Environment Variables |

If builds were failing since Feb 13, fix the cause (often env or build command), then push again or trigger a redeploy from the Vercel dashboard.

## 6. "Profile validation failed" / Missing Supabase env on kinetix.bookiji.com

You do **not** restart Vercel. The app shows that error when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing in the **deployment** environment.

1. In **Vercel** → **Kinetix** project → **Settings** → **Environment Variables**.
2. Add for **Production** (and optionally Preview):
   - `VITE_SUPABASE_URL` = same as Bookiji Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = same as Bookiji anon/public key
3. **Redeploy**: Deployments → … on latest → **Redeploy** (or push a commit).

Values must match the Bookiji Supabase project for SSO. See [ENV_PARITY.md](./ENV_PARITY.md) for details.

## 7. Withings sync and Content-Security-Policy (`connect-src`)

The web app calls the Withings Measure API from the browser (`https://wbsapi.withings.net`). Production CSP is set in **root** [`vercel.json`](../../vercel.json) (`Content-Security-Policy` → `connect-src`). That list must include **`https://wbsapi.withings.net`**. If it is missing, the browser blocks the request and weight sync can surface as **Failed to fetch** in the UI while same-origin calls (e.g. `/api/withings-refresh`) still work.
