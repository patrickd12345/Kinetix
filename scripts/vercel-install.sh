#!/bin/bash
set -e

# Clone Bookiji-inc packages: Vercel sets GITHUB_TOKEN. CI may use BOOKIJI_INC_CLONE_TOKEN
# (PAT with repo read) when the monorepo is private; otherwise unauthenticated public clone.
clone_url() {
  if [ -n "${BOOKIJI_INC_CLONE_TOKEN:-}" ]; then
    echo "https://x-access-token:${BOOKIJI_INC_CLONE_TOKEN}@github.com/patrickd12345/Bookiji-inc.git"
  elif [ -n "${GITHUB_TOKEN:-}" ]; then
    # x-access-token form matches GitHub HTTPS conventions (Vercel, Actions github.token, PATs).
    # Default GITHUB_TOKEN in Actions often lacks cross-repo read on a private Bookiji-inc; use
    # BOOKIJI_INC_CLONE_TOKEN when the umbrella repo is private.
    echo "https://x-access-token:${GITHUB_TOKEN}@github.com/patrickd12345/Bookiji-inc.git"
  else
    echo "https://github.com/patrickd12345/Bookiji-inc.git"
  fi
}

rm -rf .bookiji-tmp
rm -rf .bookiji-packages
# Shallow clone of main tree only. Do not use --recurse-submodules: umbrella submodules (ai-core,
# products/*) are huge and not needed; Kinetix copies Bookiji-inc repo-root packages/* into monorepo-packages/ for @bookiji-inc/*.
if ! env GIT_TERMINAL_PROMPT=0 git clone --depth 1 "$(clone_url)" .bookiji-tmp; then
  echo "Warning: Auth clone failed. Falling back to unauthenticated public clone."
  env GIT_TERMINAL_PROMPT=0 git clone --depth 1 "https://github.com/patrickd12345/Bookiji-inc.git" .bookiji-tmp
fi
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
# VERCEL_ENV is set on Vercel builds; some installCommand shells omit VERCEL=1.
if [ -n "${VERCEL:-}" ] || [ -n "${VERCEL_ENV:-}" ]; then
  rm -rf node_modules
fi

# Pin pnpm 10.x via npx (avoids corepack writing under Program Files on Windows → EPERM; same on Vercel/Linux).
# pnpm treats lockfile as frozen when CI=true unless --no-frozen-lockfile is passed.
# Kinetix copies umbrella packages from a fresh Bookiji-inc clone; committed pnpm-lock.yaml can lag
# those package.json files (e.g. new workspace devDependencies). Vercel/GitHub install shells are not
# guaranteed to set VERCEL=1, so default to reconciling. Use PNPM_FROZEN_LOCKFILE=1 only when the
# lockfile is known to match the clone (strict gates).
if [ "${PNPM_FROZEN_LOCKFILE:-}" = "1" ]; then
  npx -y pnpm@10.30.3 install --frozen-lockfile
else
  npx -y pnpm@10.30.3 install --no-frozen-lockfile
fi

# monorepo-packages/* are source-only (dist/ gitignored). Root `pnpm install` runs `prepare`, which
# builds shared packages so @bookiji-inc/* resolve to dist/ before Vercel traces /api and before apps/web build.
