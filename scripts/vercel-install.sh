#!/bin/bash
set -e

# Clone Bookiji-inc packages: Vercel sets GITHUB_TOKEN. CI may use BOOKIJI_INC_CLONE_TOKEN
# (PAT with repo read) when the monorepo is private; otherwise unauthenticated public clone.
clone_url() {
  if [ -n "${BOOKIJI_INC_CLONE_TOKEN:-}" ]; then
    echo "https://${BOOKIJI_INC_CLONE_TOKEN}@github.com/patrickd12345/Bookiji-inc.git"
  elif [ -n "${GITHUB_TOKEN:-}" ] && [ "${GITHUB_ACTIONS:-}" != "true" ]; then
    # Vercel's default GITHUB_TOKEN or Actions github.token (which lacks cross-repo scopes unless PAT is used)
    echo "https://${GITHUB_TOKEN}@github.com/patrickd12345/Bookiji-inc.git"
  elif [ -n "${GITHUB_TOKEN:-}" ] && [ "${GITHUB_ACTIONS:-}" == "true" ]; then
    # In GitHub Actions, the default GITHUB_TOKEN has an x-access-token format but does not have
    # read access to other repositories. This will fail if Bookiji-inc is private unless
    # BOOKIJI_INC_CLONE_TOKEN is used.
    # We append the token in a way that doesn't cause credential-helper loops on Actions.
    echo "https://x-access-token:${GITHUB_TOKEN}@github.com/patrickd12345/Bookiji-inc.git"
  else
    echo "https://github.com/patrickd12345/Bookiji-inc.git"
  fi
}

rm -rf .bookiji-tmp
rm -rf .bookiji-packages
# Shallow clone of main tree only. Do not use --recurse-submodules: umbrella submodules (ai-core,
# products/*) are huge and not needed; Kinetix copies Bookiji-inc repo-root packages/* into monorepo-packages/ for @bookiji-inc/*.

URL=$(clone_url)
# If the repo is private and we don't have a token, clone will prompt for auth or fail in CI.
# We explicitly disable terminal prompts so it fails immediately.
env GIT_TERMINAL_PROMPT=0 git clone --depth 1 "$URL" .bookiji-tmp
mv .bookiji-tmp/packages .bookiji-packages
rm -rf .bookiji-tmp

if [ ! -f .bookiji-packages/ai-runtime/package.json ]; then
  echo "Error: Bookiji-inc clone did not produce .bookiji-packages/ai-runtime/package.json."
  echo "Check that patrickd12345/Bookiji-inc default branch includes packages/ai-runtime (not an uninitialized submodule)."
  ls -la .bookiji-packages/ai-runtime 2>/dev/null || ls -la .bookiji-packages || true
  exit 1
fi

if [ ! -f .bookiji-packages/ai-core/package.json ]; then
  echo "Cloning ai-core submodule..."
  rm -rf .bookiji-packages/ai-core
  git clone --depth 1 https://github.com/patrickd12345/ai-core.git .bookiji-packages/ai-core
fi

# Refreshes monorepo-packages/ before pnpm install so workspace:* resolves @bookiji-inc/* (Kinetix-only code stays under packages/core).
# Use a real directory copy, not a symlink: Vercel's serverless file tracer can miss workspace targets
# behind symlinks, causing ERR_MODULE_NOT_FOUND for @bookiji-inc/* in production.
rm -rf monorepo-packages
cp -a .bookiji-packages monorepo-packages

# Vercel restores dependency cache across deploys; a stale node_modules/.pnpm/lock.yaml from another
# pnpm version triggers: WARN Ignoring not compatible lockfile at .../node_modules/.pnpm/lock.yaml
if [ -n "${VERCEL:-}" ]; then
  rm -rf node_modules
fi

# Pin pnpm 10.x via npx (avoids corepack writing under Program Files on Windows → EPERM; same on Vercel/Linux).
# pnpm treats lockfile as frozen when CI=true unless --no-frozen-lockfile is passed.
# On Vercel, Bookiji-inc is cloned fresh; Kinetix's committed lockfile can lag umbrella main (e.g. ai-runtime deps).
# Reconcile here unless explicitly forcing frozen via PNPM_NO_FROZEN_LOCKFILE=0 and a matching lockfile.
if [ -n "${PNPM_NO_FROZEN_LOCKFILE:-}" ] || [ -n "${VERCEL:-}" ]; then
  npx -y pnpm@10.30.3 install --no-frozen-lockfile
else
  npx -y pnpm@10.30.3 install --frozen-lockfile
fi

# monorepo-packages/* are source-only (dist/ gitignored). Root `pnpm install` runs `prepare`, which
# builds shared packages so @bookiji-inc/* resolve to dist/ before Vercel traces /api and before apps/web build.
