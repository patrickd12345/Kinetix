#!/bin/bash
set -e

# Clone Bookiji-inc packages: Vercel sets GITHUB_TOKEN. CI may use BOOKIJI_INC_CLONE_TOKEN
# (PAT with repo read) when the monorepo is private; otherwise unauthenticated public clone.

# Do not prompt for credentials in non-interactive shell (prevents hanging/exit 128)
export GIT_TERMINAL_PROMPT=0

# Helper to clone while unsetting any persistent headers from actions/checkout
# that might interfere with cross-repo access.
git_clone_raw() {
  local url="$1"
  local dest="$2"
  # Use -c http.extraheader="" to clear ANY existing auth headers from actions/checkout.
  # This is the most robust way to ensure we use the credentials in the URL.
  env GIT_TERMINAL_PROMPT=0 git -c http.extraheader="" clone --depth 1 "$url" "$dest"
}

clone_with_fallbacks() {
  local repo_name="$1"
  local dest="$2"
  local token="${BOOKIJI_INC_CLONE_TOKEN:-${GITHUB_TOKEN:-}}"

  # 1. Try x-access-token authenticated clone if token is available
  if [ -n "$token" ]; then
    echo "Attempting authenticated clone of ${repo_name} (x-access-token)..."
    if git_clone_raw "https://x-access-token:${token}@github.com/patrickd12345/${repo_name}.git" "$dest"; then
      return 0
    fi
    echo "Warning: x-access-token clone failed for ${repo_name}."

    # 2. Try legacy token-as-username authenticated clone (some environments prefer this)
    echo "Attempting authenticated clone of ${repo_name} (token-as-username)..."
    if git_clone_raw "https://${token}:x-oauth-basic@github.com/patrickd12345/${repo_name}.git" "$dest"; then
      return 0
    fi
    echo "Warning: token-as-username clone failed for ${repo_name}."
  fi

  # 3. Try unauthenticated public clone as fallback
  echo "Attempting unauthenticated clone of ${repo_name}..."
  if git_clone_raw "https://github.com/patrickd12345/${repo_name}.git" "$dest"; then
    return 0
  fi

  return 1
}

rm -rf .bookiji-packages
rm -rf .bookiji-tmp
rm -rf monorepo-packages

if clone_with_fallbacks "Bookiji-inc" ".bookiji-tmp"; then
  mv .bookiji-tmp/packages .bookiji-packages
  rm -rf .bookiji-tmp
else
  echo "Error: Failed to clone Bookiji-inc repo."
  exit 1
fi

if [ ! -f .bookiji-packages/ai-runtime/package.json ]; then
  echo "Error: Bookiji-inc clone did not produce .bookiji-packages/ai-runtime/package.json."
  echo "Check that patrickd12345/Bookiji-inc default branch includes packages/ai-runtime (not an uninitialized submodule)."
  ls -la .bookiji-packages/ai-runtime 2>/dev/null || ls -la .bookiji-packages || true
  exit 1
fi

if [ ! -f .bookiji-packages/ai-core/package.json ]; then
  echo "Cloning ai-core submodule..."
  rm -rf .bookiji-packages/ai-core
  if ! clone_with_fallbacks "ai-core" ".bookiji-packages/ai-core"; then
    echo "Error: Failed to clone ai-core submodule."
    exit 1
  fi
fi

# Must exist before pnpm install so workspace:* resolves @bookiji-inc/* (do not use `packages/` — @kinetix/core).
# Use a real directory copy, not a symlink: Vercel's serverless file tracer can miss workspace targets
# behind symlinks, causing ERR_MODULE_NOT_FOUND for @bookiji-inc/* in production.
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
