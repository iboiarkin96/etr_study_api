#!/usr/bin/env bash
# tunnels-up.sh — publish local Vite (:5173) via a single Cloudflare quick
# tunnel and copy its URL to the clipboard for pasting into @BotFather →
# Menu Button.
#
# Called from the root Makefile via `make up` (unless NO_TUNNEL=1) or
# `make tma-tunnel-up`. PID / log land under <repo>/.runtime/ next to the
# other background procs.
#
# WHY ONE TUNNEL AND NOT TWO — the earlier version of this script published
# BOTH :5173 (front) AND :8000 (API) and wrote the API tunnel URL into
# services/telegram/.env.local as VITE_API_BASE_URL. That doubled the
# maintenance surface: every restart handed out fresh URLs on BOTH tunnels,
# and a stale VITE_API_BASE_URL silently broke the auth handshake with a
# network error the user reads as «Authorization failed». The Vite dev
# server now proxies /api/* to http://localhost:8000 (vite.config.ts),
# so the frontend can talk to the API through the SAME origin as itself —
# one tunnel is enough, and the client uses relative URLs so nothing in
# .env.local needs updating between restarts.
#
# Idempotent: if the front tunnel is already running (PID file live), skips.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"

RUNTIME_DIR=".runtime"
ENV_LOCAL="services/telegram/.env.local"

FRONT_PORT="${FRONT_PORT:-5173}"

mkdir -p "$RUNTIME_DIR"

command -v cloudflared >/dev/null 2>&1 || {
  printf '  ✗ cloudflared not installed — run: brew install cloudflared\n' >&2
  exit 1
}

# -- helpers -----------------------------------------------------------------

is_alive() {
  [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null
}

start_tunnel() {
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
  local key="$1" value="$2"
  local file="$ENV_LOCAL"
  touch "$file"
  if grep -qE "^${key}=" "$file"; then
    local tmp="${file}.tmp"
    awk -v k="$key" -v v="$value" \
      'BEGIN{FS=OFS="="} $1==k {print k"="v; next} {print}' \
      "$file" > "$tmp" && mv "$tmp" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

strip_env_key() {
  # Idempotently remove a key from .env.local — used to erase a stale
  # VITE_API_BASE_URL left over from the previous (two-tunnel) setup.
  local key="$1"
  local file="$ENV_LOCAL"
  [ -f "$file" ] || return 0
  if grep -qE "^${key}=" "$file"; then
    local tmp="${file}.tmp"
    grep -vE "^${key}=" "$file" > "$tmp" || true
    mv "$tmp" "$file"
    printf '  ✓ removed stale %s from %s (proxy handles /api now)\n' "$key" "$file"
  fi
}

stop_orphan_api_tunnel() {
  # Older tunnels-up.sh (before we switched to proxy) started an API tunnel
  # on :8000 and left its PID at .runtime/tma-tunnel-api.pid. Kill it so
  # `make down` doesn't need to worry about it, and the .env.local doesn't
  # get rewritten on the next `make up`.
  local pidfile="$RUNTIME_DIR/tma-tunnel-api.pid"
  [ -f "$pidfile" ] || return 0
  local pid; pid="$(cat "$pidfile")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    printf '  ✓ stopped orphan API tunnel (PID %s) — proxy handles /api now\n' "$pid"
  fi
  rm -f "$pidfile" "$RUNTIME_DIR/tma-tunnel-api.log"
}

regenerate_dev_init_data() {
  # VITE_DEV_INIT_DATA lets the plain-browser dev loop (no real Telegram)
  # complete the auth handshake. Telegram's initData has a 24 h TTL
  # (TELEGRAM_INIT_DATA_MAX_AGE_SECONDS in env/dev) — a stale one served
  # the client returns 401 from /api/v1/auth/telegram, which the user
  # reads as «Authorization failed» and can't easily diagnose. Regenerate
  # on every `make up` (cheap; the signer is stdlib-only) so the
  # local browser loop is always ready.
  local token
  token="$(grep -E '^TELEGRAM_BOT_TOKEN=' "$REPO_ROOT/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' | sed -e "s/^['\"]//" -e "s/['\"]$//")"
  if [ -z "$token" ]; then
    printf '  i skipping VITE_DEV_INIT_DATA regen — no TELEGRAM_BOT_TOKEN in .env\n'
    return 0
  fi
  local signer="$REPO_ROOT/tools/dev/sign_init_data.py"
  if [ ! -f "$signer" ]; then
    printf '  i skipping VITE_DEV_INIT_DATA regen — %s missing\n' "$signer" >&2
    return 0
  fi
  # Prefer shell env, then a persisted value in root .env (same file the
  # bot token lives in), fall back to 42 — the historical dev default.
  local env_user_id=""
  if [ -f "$REPO_ROOT/.env" ]; then
    env_user_id="$(grep -E '^TMA_DEV_TELEGRAM_USER_ID=' "$REPO_ROOT/.env" 2>/dev/null \
      | tail -1 | cut -d= -f2- | tr -d '\r' | tr -d '"' | tr -d "'")"
  fi
  local user_id="${TMA_DEV_TELEGRAM_USER_ID:-${env_user_id:-42}}"
  local fresh
  fresh="$(python3 "$signer" --bot-token "$token" --user-id "$user_id" --format env 2>/dev/null || true)"
  if [ -z "$fresh" ]; then
    printf '  ✗ VITE_DEV_INIT_DATA regen failed (see: python3 %s --bot-token …)\n' "$signer" >&2
    return 0
  fi
  # `fresh` is a `KEY=value` line — split and upsert.
  local key value
  key="${fresh%%=*}"
  value="${fresh#*=}"
  upsert_env "$key" "$value"
  printf '  ✓ regenerated %s (24 h TTL) — plain-browser dev loop is ready\n' "$key"
}

update_bot_menu_button() {
  # Point the bot's default Menu Button at the fresh tunnel URL so the user
  # doesn't have to touch @BotFather on every restart. Cloudflare quick
  # tunnels hand out a new hostname each time cloudflared starts; the old
  # URL 404s once the process dies, and the user reads that as "Server not
  # found" in the WebView. setChatMenuButton overwrites the default one on
  # the bot side — no chat_id needed. Requires TELEGRAM_BOT_TOKEN in .env.
  local front_url="$1"
  local repo_env="$REPO_ROOT/.env"
  local token=""
  if [ -f "$repo_env" ]; then
    token="$(grep -E '^TELEGRAM_BOT_TOKEN=' "$repo_env" 2>/dev/null | tail -1 \
      | cut -d= -f2- | tr -d '\r' | tr -d '"' | tr -d "'")"
  fi
  if [ -z "$token" ]; then
    printf '  i skipping Menu Button update — no TELEGRAM_BOT_TOKEN in .env\n'
    return 0
  fi
  local text="${TMA_MENU_BUTTON_TEXT:-Open}"
  local body
  body="$(python3 -c "import json,sys; print(json.dumps({'menu_button':{'type':'web_app','text':'$text','web_app':{'url':'$front_url'}}}))")"
  local resp
  resp="$(curl -sS -m 8 -X POST "https://api.telegram.org/bot${token}/setChatMenuButton" \
    -H 'Content-Type: application/json' \
    --data "$body" 2>/dev/null || true)"
  case "$resp" in
    *'"ok":true'*)
      printf '  ✓ Menu Button updated on @BotFather side — reopen the bot chat to see it\n'
      ;;
    *)
      printf '  ! setChatMenuButton did not confirm ok — falling back to manual paste\n'
      printf '    response: %s\n' "${resp:-<empty>}"
      ;;
  esac
}

# -- main --------------------------------------------------------------------

stop_orphan_api_tunnel
strip_env_key VITE_API_BASE_URL
regenerate_dev_init_data

printf '  → Cloudflare tunnel for frontend (:%s)\n' "$FRONT_PORT"
start_tunnel "$FRONT_PORT" front
FRONT_URL="$(wait_for_url front)"
printf '  ✓ frontend tunnel: %s\n' "$FRONT_URL"

# Sticky note for the human: no code reads TMA_FRONTEND_URL — it is only
# echoed back by `make up` so you can see the current tunnel address.
upsert_env TMA_FRONTEND_URL "$FRONT_URL"

# Push the fresh URL straight to Telegram so the Menu Button in every
# private chat with the bot points at it. Failure here is non-fatal —
# script falls back to the printed «paste it into @BotFather» banner.
update_bot_menu_button "$FRONT_URL"

CLIP_HINT=''
if command -v pbcopy >/dev/null 2>&1; then
  printf '%s' "$FRONT_URL" | pbcopy
  CLIP_HINT=' (copied to clipboard)'
fi

cat <<EOF

╔══════════════════════════════════════════════════════════════════════╗
║  TMA tunnel is live${CLIP_HINT}
╠══════════════════════════════════════════════════════════════════════╣
║  Frontend  ${FRONT_URL}
║  API       proxied via Vite → http://localhost:8000 (no tunnel needed)
╠══════════════════════════════════════════════════════════════════════╣
║  Menu Button auto-updated via Bot API — reopen the bot chat and tap
║  the button. Fallback (if the API call didn't confirm ok):
║    @BotFather → /mybots → <bot> → Bot Settings → Menu Button → paste
║
║  Stop with: make tma-tunnel-down  (or  make down  — stops everything)
╚══════════════════════════════════════════════════════════════════════╝

EOF
