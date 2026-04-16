#!/bin/bash
set -e

# Clone Bookiji-inc packages: Vercel sets GITHUB_TOKEN. CI may use BOOKIJI_INC_CLONE_TOKEN
# (PAT with repo read) when the monorepo is private; otherwise unauthenticated public clone.
clone_url() {
  if [ -n "${BOOKIJI_INC_CLONE_TOKEN:-}" ]; then
    echo "https://x-access-token:${BOOKIJI_INC_CLONE_TOKEN}@github.com/patrickd12345/Bookiji-inc.git"
  elif [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "https://x-access-token:${GITHUB_TOKEN}@github.com/patrickd12345/Bookiji-inc.git"
  else
    echo "https://github.com/patrickd12345/Bookiji-inc.git"
  fi
}

rm -rf .bookiji-tmp
rm -rf .bookiji-packages

# Shallow clone of main tree only. Do not use --recurse-submodules: umbrella submodules (ai-core,
# products/*) are huge and not needed; Kinetix only needs repo-root packages/* for @bookiji-inc/*.
# Try authenticated clone first; fallback to unauthenticated for public resilience.
# Use GIT_TERMINAL_PROMPT=0 to prevent hanging on credential prompts in CI.
if ! GIT_TERMINAL_PROMPT=0 git clone --depth 1 "$(clone_url)" .bookiji-tmp; then
  echo "Warning: Auth clone failed. Falling back to unauthenticated public clone."
  rm -rf .bookiji-tmp
  GIT_TERMINAL_PROMPT=0 git clone --depth 1 "https://github.com/patrickd12345/Bookiji-inc.git" .bookiji-tmp
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

# Must exist before pnpm install so workspace:* resolves @bookiji-inc/* (do not use `packages/` — @kinetix/core).
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
if [ -n "${PNPM_NO_FROZEN_LOCKFILE:-}" ]; then
  npx -y pnpm@10.30.3 install --no-frozen-lockfile
else
  npx -y pnpm@10.30.3 install --frozen-lockfile
fi

# Bookiji-inc workspace packages are source-only (no committed dist/). Vercel may trace /api
# serverless bundles before buildCommand runs apps/web (which also builds these). Emit dist/
# here so @bookiji-inc/* resolve to real files during function compilation.
node scripts/build-bookiji-packages.mjs
