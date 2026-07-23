#!/usr/bin/env bash
# scripts/tunnel.sh — publish local Vite (:5173) via Cloudflare quick tunnel.
#
# Free, no login, no domain. The URL rotates every time cloudflared restarts,
# so we scrape it out of the log, copy it to the clipboard, and print a big
# banner reminding you to paste it into @BotFather → Menu Button.
#
# Requires: cloudflared (brew install cloudflared).

set -euo pipefail

PORT="${TMA_TUNNEL_PORT:-5173}"
TARGET="http://localhost:${PORT}"

command -v cloudflared >/dev/null 2>&1 || {
  printf '✗ cloudflared not installed. Run: brew install cloudflared\n' >&2
  exit 1
}

LOG="$(mktemp -t tma-tunnel.XXXXXX)"
trap 'rm -f "$LOG"' EXIT

printf '→ Starting Cloudflare quick tunnel for %s …\n' "$TARGET"
cloudflared tunnel --url "$TARGET" --no-autoupdate > "$LOG" 2>&1 &
CF_PID=$!
trap 'kill "$CF_PID" 2>/dev/null || true; rm -f "$LOG"' EXIT INT TERM

URL=""
for _ in $(seq 1 60); do
  URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 0.5
done

if [ -z "$URL" ]; then
  printf '✗ Could not detect tunnel URL in 30s. Log:\n' >&2
  cat "$LOG" >&2
  exit 1
fi

if command -v pbcopy >/dev/null 2>&1; then
  printf '%s' "$URL" | pbcopy
  CLIP_HINT=' (copied to clipboard)'
else
  CLIP_HINT=''
fi

cat <<EOF

╔══════════════════════════════════════════════════════════════════════╗
║  TMA tunnel is live${CLIP_HINT}
╠══════════════════════════════════════════════════════════════════════╣
║  ${URL}
╠══════════════════════════════════════════════════════════════════════╣
║  Paste it into @BotFather:
║    /mybots → <your bot> → Bot Settings → Menu Button
║    → Configure menu button → URL: ${URL}
║  Then open the bot in Telegram and tap the menu button.
║
║  Ctrl+C here kills the tunnel (URL becomes invalid).
╚══════════════════════════════════════════════════════════════════════╝

EOF

wait "$CF_PID"
