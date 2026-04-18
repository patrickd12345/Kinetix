#!/bin/bash
set -e

# Clone Bookiji-inc packages using a single unified pattern as per Memory requirements.
# token resolution must prefer BOOKIJI_INC_CLONE_TOKEN and fall back to GITHUB_TOKEN.
TOKEN="${BOOKIJI_INC_CLONE_TOKEN:-${GITHUB_TOKEN:-}}"
if [ -z "$TOKEN" ]; then
  echo "Error: Neither BOOKIJI_INC_CLONE_TOKEN nor GITHUB_TOKEN is set."
  exit 1
fi

clone_repo() {
  local repo_url="$1"
  local dest="$2"
  # Strictly enforce GIT_TERMINAL_PROMPT=0 and clear auth headers inline.
  # Do not echo the full clone URL.
  env GIT_TERMINAL_PROMPT=0 git -c http.extraheader="" clone --depth 1 "$repo_url" "$dest"
}

rm -rf .bookiji-tmp
echo "Cloning Bookiji-inc..."
clone_repo "https://x-access-token:${TOKEN}@github.com/patrickd12345/Bookiji-inc" .bookiji-tmp

rm -rf .bookiji-packages
mv .bookiji-tmp/packages .bookiji-packages
rm -rf .bookiji-tmp

if [ ! -f .bookiji-packages/ai-runtime/package.json ]; then
  echo "Error: Bookiji-inc clone did not produce .bookiji-packages/ai-runtime/package.json."
  exit 1
fi

if [ ! -f .bookiji-packages/ai-core/package.json ]; then
  echo "Cloning ai-core submodule..."
  rm -rf .bookiji-packages/ai-core
  clone_repo "https://x-access-token:${TOKEN}@github.com/patrickd12345/ai-core" .bookiji-packages/ai-core
fi

# Must exist before pnpm install so workspace:* resolves @bookiji-inc/*
rm -rf monorepo-packages
cp -a .bookiji-packages monorepo-packages

if [ -n "${VERCEL:-}" ] || [ -n "${VERCEL_ENV:-}" ]; then
  rm -rf node_modules
fi

if [ "${PNPM_FROZEN_LOCKFILE:-}" = "1" ]; then
  npx -y pnpm@10.30.3 install --frozen-lockfile
else
  npx -y pnpm@10.30.3 install --no-frozen-lockfile
fi

node scripts/build-bookiji-packages.mjs
