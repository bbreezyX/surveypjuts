#!/usr/bin/env bash
# Rewrite every ?v=... query string in index.html to a deploy version.
# Run before deploy: ./scripts/bump-version.sh
#
# Pass a version explicitly as the first argument, or the script will use
# YYYYMMDDHHMM so multiple deploys in one day invalidate correctly.

set -eu
cd "$(dirname "$0")/.."

NEW_VERSION="${1:-$(date +%Y%m%d%H%M)}"

tmp="$(mktemp)"
sed -E "s/\\?v=[0-9A-Za-z._-]+/?v=${NEW_VERSION}/g" index.html > "$tmp"
mv "$tmp" index.html

echo "Bumped ?v=... to ${NEW_VERSION} in index.html"
