#!/bin/bash
set -e

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GITHUB_TOKEN environment variable is missing."
  exit 1
fi

git clone --depth 1 "https://${GITHUB_TOKEN}@github.com/patrickd12345/Bookiji-inc.git" .bookiji-tmp
mv .bookiji-tmp/packages .bookiji-packages
rm -rf .bookiji-tmp

# Must exist before pnpm install so workspace:* resolves @bookiji-inc/* (do not use `packages/` — @kinetix/core)
ln -sfn "$(pwd)/.bookiji-packages" "$(pwd)/monorepo-packages"

# Match package.json "packageManager": pnpm@10.x — do not use pnpm@8 (ignores lockfile v9)
corepack enable
corepack prepare pnpm@10.30.3 --activate

pnpm install --frozen-lockfile
