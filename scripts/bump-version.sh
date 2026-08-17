#!/usr/bin/env bash
# Rewrite every ?v=... query string in index.html to a deploy version.
# Run before deploy: ./scripts/bump-version.sh
#
# Pass a version explicitly as the first argument, or the script will use
# YYYYMMDDHHMM so multiple deploys in one day invalidate correctly.

set -eu
cd "$(dirname "$0")/.."

NEW_VERSION="${1:-$(date +%Y%m%d%H%M)}"

# manifest.json is in the list because its icons live under /assets/*, which the
# Caddyfile serves as immutable — without a token that rises too, those icons
# would never be replaced.
for f in index.html manifest.json; do
    [ -f "$f" ] || continue
    tmp="$(mktemp)"
    sed -E "s/\\?v=[0-9A-Za-z._-]+/?v=${NEW_VERSION}/g" "$f" > "$tmp"
    mv "$tmp" "$f"
    echo "Bumped ?v=... to ${NEW_VERSION} in ${f}"
done
