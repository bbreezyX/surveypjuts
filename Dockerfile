FROM caddy:2.8-alpine

WORKDIR /srv

COPY Caddyfile /etc/caddy/Caddyfile
COPY . /srv

# Cache-busting happens here, not as a step someone has to remember before
# deploy. The Caddyfile serves custom.js, custom.css, layers/*, resources/*
# and friends as immutable (max-age one year), so a browser only refetches
# them when the ?v= token in index.html changes. Railway injects the commit
# SHA at build time; every deploy rewrites every token to that SHA, so a push
# is enough. Outside Railway (a local docker build) the build timestamp
# stands in. scripts/bump-version.sh still works for manual use but is no
# longer required.
#
# grep -c exits 1 when nothing matched, which fails the build rather than
# shipping an index.html whose tokens silently stopped being rewritten.
ARG RAILWAY_GIT_COMMIT_SHA
RUN TOKEN="${RAILWAY_GIT_COMMIT_SHA:-$(date +%Y%m%d%H%M%S)}"; \
    TOKEN="$(printf '%s' "$TOKEN" | cut -c1-12)"; \
    sed -i "s/?v=[0-9A-Za-z._-]*/?v=${TOKEN}/g" /srv/index.html /srv/manifest.json && \
    grep -c "?v=${TOKEN}" /srv/index.html
