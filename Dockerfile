FROM caddy:2.8-alpine

WORKDIR /srv

COPY Caddyfile /etc/caddy/Caddyfile
COPY . /srv