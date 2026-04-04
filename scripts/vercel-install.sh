#!/bin/bash
set -e

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GITHUB_TOKEN environment variable is missing."
  exit 1
fi

git clone --depth 1 "https://${GITHUB_TOKEN}@github.com/patrickd12345/Bookiji-inc.git" .bookiji-tmp
mv .bookiji-tmp/packages .bookiji-packages
rm -rf .bookiji-tmp

npx pnpm@8 install
