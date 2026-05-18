# services/portal — static documentation site.
#
# Per ADR 0028 (`services/portal/internal/governance/adr/0028-monorepo-with-service-boundaries.html`),
# the portal is one of three services in the monorepo. It serves the portal HTML tree as
# static assets behind a thin web server. The image carries no Python runtime — that is
# the deliberate separation from the API service.
#
# Build context: repo root (so the COPY can pick up both services/portal/ and
# services/frontend/portal/assets/ from the same context).
# Build:  docker build -f services/portal/Dockerfile -t study-app-portal .
# Run:    docker run --rm -p 8080:80 study-app-portal

FROM nginx:1.27-alpine

# Copy the HTML documentation tree as the nginx web root.
COPY services/portal /usr/share/nginx/html

# HTML pages reference JS/CSS assets as /frontend/portal/assets/ (relative paths
# from the portal root resolve to this absolute URL regardless of page depth).
# Place the assets at that exact path inside the web root.
COPY services/frontend/portal/assets /usr/share/nginx/html/frontend/portal/assets

# Tighten the default nginx config: serve index.html as the directory index,
# return 404 for missing files (no SPA-style fallback — this is a static site
# with hand-written routes).
RUN printf '%s\n' \
    'server {' \
    '  listen 80;' \
    '  server_name _;' \
    '  root /usr/share/nginx/html;' \
    '  index index.html;' \
    '  location / { try_files $uri $uri/ =404; }' \
    '  add_header X-Frame-Options "SAMEORIGIN" always;' \
    '  add_header X-Content-Type-Options "nosniff" always;' \
    '  add_header Referrer-Policy "strict-origin-when-cross-origin" always;' \
    '}' \
    > /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/index.html >/dev/null 2>&1 || exit 1
