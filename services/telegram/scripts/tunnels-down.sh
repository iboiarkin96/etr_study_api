#!/usr/bin/env bash
# tunnels-down.sh — stop the two Cloudflare quick tunnels started by
# tunnels-up.sh and strip VITE_API_BASE_URL out of services/telegram/.env.local
# so a bare `make up` again defaults back to http://localhost:8000.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"

RUNTIME_DIR=".runtime"
ENV_LOCAL="services/telegram/.env.local"

stop_tunnel() {
  local name="$1"
  local pidfile="$RUNTIME_DIR/tma-tunnel-$name.pid"

  if [ ! -f "$pidfile" ]; then
    printf '  i tunnel/%s not running\n' "$name"
    return 0
  fi

  local pid; pid="$(cat "$pidfile")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    printf '  ✓ tunnel/%s stopped (PID %s)\n' "$name" "$pid"
  else
    printf '  i tunnel/%s PID %s stale\n' "$name" "$pid"
  fi
  rm -f "$pidfile"
}

strip_env_key() {
  local key="$1"
  local file="$ENV_LOCAL"
  [ -f "$file" ] || return 0
  local tmp="${file}.tmp"
  grep -vE "^${key}=" "$file" > "$tmp" || true
  mv "$tmp" "$file"
  printf '  ✓ removed %s from %s\n' "$key" "$file"
}

stop_tunnel front
stop_tunnel api
strip_env_key VITE_API_BASE_URL
