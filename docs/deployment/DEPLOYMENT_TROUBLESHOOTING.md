# Kinetix deployment troubleshooting

If Kinetix (Vercel) has not deployed since a certain date, check the following.

## 1. Vercel dashboard

- Open the [Vercel dashboard](https://vercel.com/dashboard) and the **Kinetix** project.
- **Deployments**: See if recent commits triggered builds. If there are no new deployments, either no pushes reached the connected branch or the Git integration is disconnected.
- **Failed builds**: If deployments appear but show "Error" or "Failed", open the build log. Common causes:
  - Missing or wrong env vars (e.g. Supabase, Stripe).
  - `pnpm install` or `pnpm run build` failing (e.g. Node/pnpm version, lockfile mismatch).
  - `outputDirectory` in `vercel.json` does not match the actual build output (e.g. `apps/web/dist`).

## 2. Branch and Git connection

- In Vercel: **Settings → Git** and confirm which branch is the **Production Branch** (often `main`).
- Ensure you push to that branch: `git push origin main` (or your production branch). Pushes to other branches create preview deployments only.
- If the repo was renamed or the Vercel project was recreated, reconnect the repo in Vercel (Settings → Git → Connect Git Repository).

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
