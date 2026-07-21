#!/usr/bin/env bash
# tunnels-up.sh — publish local Vite (:5173) + API (:8000) via Cloudflare quick
# tunnels, wire the fresh API URL into services/telegram/.env.local, restart
# Vite so the new env is picked up, and copy the frontend URL to the clipboard.
#
# Called from the root Makefile via `TMA_TUNNEL=1 make up` or `make tma-tunnel-up`.
# PIDs / logs land under <repo>/.runtime/ next to the other background procs.
#
# Idempotent: if a tunnel is already running (PID file live), skips it.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"

RUNTIME_DIR=".runtime"
ENV_LOCAL="services/telegram/.env.local"

API_PORT="${API_PORT:-8000}"
FRONT_PORT="${FRONT_PORT:-5173}"

mkdir -p "$RUNTIME_DIR"

command -v cloudflared >/dev/null 2>&1 || {
  printf '  ✗ cloudflared not installed — run: brew install cloudflared\n' >&2
  exit 1
}

# -- helpers -----------------------------------------------------------------

is_alive() {
  # $1 = pidfile
  [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null
}

start_tunnel() {
  # $1 = local port, $2 = name (api|front)
  local port="$1" name="$2"
  local pidfile="$RUNTIME_DIR/tma-tunnel-$name.pid"
  local logfile="$RUNTIME_DIR/tma-tunnel-$name.log"

  if is_alive "$pidfile"; then
    printf '  i tunnel/%s already running (PID %s)\n' "$name" "$(cat "$pidfile")"
    return 0
  fi

  if ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    printf '  ✗ nothing listening on :%s — bring up %s first (make up)\n' "$port" "$name" >&2
    exit 1
  fi

  : > "$logfile"
  nohup cloudflared tunnel --url "http://localhost:$port" --no-autoupdate \
    > "$logfile" 2>&1 &
  echo $! > "$pidfile"
  printf '  → tunnel/%s starting (PID %s, log: %s)\n' "$name" "$(cat "$pidfile")" "$logfile"
}

wait_for_url() {
  # $1 = name, echoes URL on stdout
  local name="$1"
  local logfile="$RUNTIME_DIR/tma-tunnel-$name.log"
  local url=""
  for _ in $(seq 1 60); do
    url="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$logfile" 2>/dev/null | head -1 || true)"
    [ -n "$url" ] && { printf '%s' "$url"; return 0; }
    sleep 0.5
  done
  printf '  ✗ tunnel/%s did not surface a URL in 30s. Tail of log:\n' "$name" >&2
  tail -20 "$logfile" >&2 || true
  exit 1
}

upsert_env() {
  # $1 = key, $2 = value; writes to services/telegram/.env.local
  local key="$1" value="$2"
  local file="$ENV_LOCAL"
  touch "$file"
  if grep -qE "^${key}=" "$file"; then
    # in-place replace, portable across macOS/GNU sed
    local tmp="${file}.tmp"
    awk -v k="$key" -v v="$value" \
      'BEGIN{FS=OFS="="} $1==k {print k"="v; next} {print}' \
      "$file" > "$tmp" && mv "$tmp" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

restart_vite() {
  local pidfile="$RUNTIME_DIR/tma.pid"
  local logfile="$RUNTIME_DIR/tma.log"

  if is_alive "$pidfile"; then
    local pid; pid="$(cat "$pidfile")"
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
    # wait up to 5s for the port to free
    for _ in $(seq 1 10); do
      lsof -nP -iTCP:"$FRONT_PORT" -sTCP:LISTEN >/dev/null 2>&1 || break
      sleep 0.5
    done
    rm -f "$pidfile"
  fi

  if [ ! -x services/telegram/node_modules/.bin/vite ]; then
    printf '  ✗ services/telegram/node_modules missing — run: make -C services/telegram install\n' >&2
    exit 1
  fi

  nohup sh -c "cd services/telegram && exec ./node_modules/.bin/vite --port $FRONT_PORT" \
    > "$logfile" 2>&1 &
  echo $! > "$pidfile"
  # wait for Vite to bind
  for _ in $(seq 1 20); do
    lsof -nP -iTCP:"$FRONT_PORT" -sTCP:LISTEN >/dev/null 2>&1 && break
    sleep 0.5
  done
  printf '  ✓ vite restarted (PID %s) with fresh VITE_API_BASE_URL\n' "$(cat "$pidfile")"
}

# -- main --------------------------------------------------------------------

printf '  → Cloudflare tunnel for API (:%s)\n' "$API_PORT"
start_tunnel "$API_PORT" api
API_URL="$(wait_for_url api)"
printf '  ✓ api tunnel: %s\n' "$API_URL"

printf '  → writing VITE_API_BASE_URL to %s\n' "$ENV_LOCAL"
upsert_env VITE_API_BASE_URL "$API_URL"

printf '  → restarting Vite to pick up new env\n'
restart_vite

printf '  → Cloudflare tunnel for frontend (:%s)\n' "$FRONT_PORT"
start_tunnel "$FRONT_PORT" front
FRONT_URL="$(wait_for_url front)"
printf '  ✓ frontend tunnel: %s\n' "$FRONT_URL"

CLIP_HINT=''
if command -v pbcopy >/dev/null 2>&1; then
  printf '%s' "$FRONT_URL" | pbcopy
  CLIP_HINT=' (copied to clipboard)'
fi

cat <<EOF

╔══════════════════════════════════════════════════════════════════════╗
║  TMA tunnels are live${CLIP_HINT}
╠══════════════════════════════════════════════════════════════════════╣
║  Frontend  ${FRONT_URL}
║  API       ${API_URL}
╠══════════════════════════════════════════════════════════════════════╣
║  Paste the frontend URL into @BotFather:
║    /mybots → <bot> → Bot Settings → Menu Button → Configure → paste
║  Then close and reopen the Mini App in Telegram.
║
║  Stop with: make tma-tunnel-down  (or  make down  — stops everything)
╚══════════════════════════════════════════════════════════════════════╝

EOF
