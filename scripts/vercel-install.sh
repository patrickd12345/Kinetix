#!/bin/bash
set -e

# Helper to clone using exactly one pattern as per memory.
# Strictly enforces GIT_TERMINAL_PROMPT=0 and clears http.extraheader inline.
git_clone() {
  local repo_name="$1"
  local dest="$2"

  if [ -z "${BOOKIJI_INC_CLONE_TOKEN:-}" ] && [ -z "${GITHUB_TOKEN:-}" ]; then
    echo "Error: Neither BOOKIJI_INC_CLONE_TOKEN nor GITHUB_TOKEN is set. Cross-repo clone required for monorepo packages."
    exit 1
  fi

  # Never echo TOKEN or full clone URL in logs.
  echo "Cloning patrickd12345/${repo_name}..."

  # Prefer BOOKIJI_INC_CLONE_TOKEN and fall back to GITHUB_TOKEN inline
  if [ -n "${BOOKIJI_INC_CLONE_TOKEN:-}" ]; then
    if env GIT_TERMINAL_PROMPT=0 git -c http.extraheader="" clone --depth 1 "https://x-access-token:${BOOKIJI_INC_CLONE_TOKEN}@github.com/patrickd12345/${repo_name}.git" "$dest"; then
      return 0
    fi
  fi

  if [ -n "${GITHUB_TOKEN:-}" ]; then
    if env GIT_TERMINAL_PROMPT=0 git -c http.extraheader="" clone --depth 1 "https://x-access-token:${GITHUB_TOKEN}@github.com/patrickd12345/${repo_name}.git" "$dest"; then
      return 0
    fi
  fi

  echo "Error: Failed to clone ${repo_name} with available tokens."
  exit 1
}

rm -rf .bookiji-tmp
rm -rf .bookiji-packages

# Clone Bookiji-inc umbrella repo to extract shared packages.
git_clone "Bookiji-inc" .bookiji-tmp
mv .bookiji-tmp/packages .bookiji-packages
rm -rf .bookiji-tmp

if [ ! -f .bookiji-packages/ai-runtime/package.json ]; then
  echo "Error: Bookiji-inc clone did not produce .bookiji-packages/ai-runtime/package.json."
  echo "Check that patrickd12345/Bookiji-inc default branch includes packages/ai-runtime (not an uninitialized submodule)."
  ls -la .bookiji-packages/ai-runtime 2>/dev/null || ls -la .bookiji-packages || true
  exit 1
fi

# Clone ai-core if missing (it might be a submodule in the source repo).
if [ ! -f .bookiji-packages/ai-core/package.json ]; then
  echo "ai-core not found in packages/, attempting standalone clone..."
  rm -rf .bookiji-packages/ai-core
  git_clone "ai-core" .bookiji-packages/ai-core
fi

# Must exist before pnpm install so workspace:* resolves @bookiji-inc/* (do not use `packages/` — @kinetix/core).
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
node scripts/build-bookiji-packages.mjs
