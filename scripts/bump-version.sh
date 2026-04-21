#!/usr/bin/env bash
# Rewrite every ?v=... query string in index.html to today's date.
# Run before deploy: ./scripts/bump-version.sh
#
# If you ever deploy twice the same day and need both bumps to invalidate,
# change `date +%Y%m%d` below to `date +%Y%m%d%H%M`.

set -eu
cd "$(dirname "$0")/.."

NEW_VERSION="$(date +%Y%m%d)"

tmp="$(mktemp)"
sed -E "s/\\?v=[0-9]+/?v=${NEW_VERSION}/g" index.html > "$tmp"
mv "$tmp" index.html

echo "Bumped ?v=... to ${NEW_VERSION} in index.html"
