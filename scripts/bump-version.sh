#!/usr/bin/env bash
# Rewrite every ?v=... query string in index.html to a deploy version.
#
# Optional since the Dockerfile started doing this at build time from the
# Railway commit SHA: a plain push now invalidates the immutable assets on its
# own. Keep this for manual use — e.g. to force a refresh without a code
# change, or when serving the tree from something other than that image.
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
