#!/bin/bash
set -e

# Clone Bookiji-inc packages: Vercel sets GITHUB_TOKEN. CI may use BOOKIJI_INC_CLONE_TOKEN
# (PAT with repo read) when the monorepo is private; otherwise unauthenticated public clone.
clone_url() {
  if [ -n "${BOOKIJI_INC_CLONE_TOKEN:-}" ]; then
    echo "https://${BOOKIJI_INC_CLONE_TOKEN}@github.com/patrickd12345/Bookiji-inc.git"
  elif [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "https://${GITHUB_TOKEN}@github.com/patrickd12345/Bookiji-inc.git"
  else
    echo "https://github.com/patrickd12345/Bookiji-inc.git"
  fi
}

rm -rf .bookiji-tmp
rm -rf .bookiji-packages
# Shallow clone of main tree only. Do not use --recurse-submodules: umbrella submodules (ai-core,
# products/*) are huge and not needed; Kinetix only needs repo-root packages/* for @bookiji-inc/*.
git clone --depth 1 "$(clone_url)" .bookiji-tmp
mv .bookiji-tmp/packages .bookiji-packages
rm -rf .bookiji-tmp

if [ ! -f .bookiji-packages/ai-runtime/package.json ]; then
  echo "Error: Bookiji-inc clone did not produce .bookiji-packages/ai-runtime/package.json."
  echo "Check that patrickd12345/Bookiji-inc default branch includes packages/ai-runtime (not an uninitialized submodule)."
  ls -la .bookiji-packages/ai-runtime 2>/dev/null || ls -la .bookiji-packages || true
  exit 1
fi

# Must exist before pnpm install so workspace:* resolves @bookiji-inc/* (do not use `packages/` — @kinetix/core)
rm -rf monorepo-packages
ln -sfn "$(pwd)/.bookiji-packages" "$(pwd)/monorepo-packages"

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
